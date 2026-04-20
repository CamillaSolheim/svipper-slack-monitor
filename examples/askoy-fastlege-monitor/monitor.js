/**
 * Askøy Fastlege Monitor
 *
 * Overvåker endringer i fastlege-data og sender varsler til Slack
 *
 * Varsler om:
 * - Nye leger som dukker opp
 * - Leger som forsvinner
 * - Endringer i status/kapasitet
 */

const { scrapeFastleger } = require('./scraper');
const { Client } = require('pg');
const axios = require('axios');

// Miljøvariabler
const DATABASE_URL = process.env.DATABASE_URL;
const SLACK_BOT_TOKEN = process.env.SLACK_BOT_TOKEN;
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || '#fastlege-varsler';

// Minimum antall fastleger vi forventer å se — brukes for å avvise feilaktig tomme resultater
const MIN_EXPECTED_FASTLEGER = 5;

// Database connection helper med SSL-støtte
function createDbClient() {
    return new Client({
        connectionString: DATABASE_URL,
        ssl: DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false }
    });
}

// Database-funksjonalitet
async function setupDatabase() {
    const client = createDbClient();
    await client.connect();

    await client.query(`
        CREATE TABLE IF NOT EXISTS fastleger (
            id VARCHAR(200) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            address TEXT,
            status VARCHAR(100),
            capacity VARCHAR(50),
            phone VARCHAR(50),
            first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_status VARCHAR(100),
            last_capacity VARCHAR(50)
        )
    `);

    await client.query(`
        CREATE TABLE IF NOT EXISTS change_log (
            id SERIAL PRIMARY KEY,
            fastlege_id VARCHAR(200),
            change_type VARCHAR(50),
            old_value TEXT,
            new_value TEXT,
            fastlege_name VARCHAR(200),
            fastlege_address TEXT,
            fastlege_capacity VARCHAR(50),
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            notified BOOLEAN DEFAULT FALSE
        )
    `);

    await client.end();
    console.log('✅ Database setup complete');
}

async function getStoredFastleger() {
    const client = createDbClient();
    await client.connect();

    const result = await client.query('SELECT * FROM fastleger');
    await client.end();

    return result.rows;
}

async function updateFastlege(fastlege) {
    const client = createDbClient();
    await client.connect();

    await client.query(`
        INSERT INTO fastleger (id, name, address, status, capacity, phone, last_status, last_capacity)
        VALUES ($1, $2, $3, $4, $5, $6, $4, $5)
        ON CONFLICT (id) DO UPDATE SET
            last_seen = CURRENT_TIMESTAMP,
            status = $4,
            capacity = $5,
            phone = $6,
            last_status = fastleger.status,
            last_capacity = fastleger.capacity
    `, [fastlege.id, fastlege.name, fastlege.address, fastlege.status, fastlege.capacity, fastlege.phone]);

    await client.end();
}

async function deleteFastleger(ids) {
    const client = createDbClient();
    await client.connect();

    await client.query('DELETE FROM fastleger WHERE id = ANY($1)', [ids]);

    await client.end();
}

// Fix 1: Lagre navn og adresse direkte i change_log — uavhengig av JOIN mot fastleger
async function logChange(fastlegeId, changeType, oldValue, newValue, name, address, capacity) {
    const client = createDbClient();
    await client.connect();

    await client.query(`
        INSERT INTO change_log (fastlege_id, change_type, old_value, new_value, fastlege_name, fastlege_address, fastlege_capacity)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [fastlegeId, changeType, oldValue, newValue, name, address, capacity]);

    await client.end();
}

async function getUnnotifiedChanges() {
    const client = createDbClient();
    await client.connect();

    // Fix 1: Bruk lagret navn/adresse fra change_log — ikke JOIN som feiler for slettede leger
    const result = await client.query(`
        SELECT *
        FROM change_log
        WHERE notified = FALSE
        ORDER BY detected_at DESC
    `);

    await client.end();
    return result.rows;
}

async function markChangesNotified(changeIds) {
    const client = createDbClient();
    await client.connect();

    await client.query(`
        UPDATE change_log
        SET notified = TRUE
        WHERE id = ANY($1)
    `, [changeIds]);

    await client.end();
}

// Slack-funksjonalitet
// Fix 3: Kast exception ved Slack API-feil slik at markChangesNotified ikke kalles
async function sendSlackMessage(message) {
    const response = await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
            channel: SLACK_CHANNEL,
            text: message,
            mrkdwn: true
        },
        {
            headers: {
                'Authorization': `Bearer ${SLACK_BOT_TOKEN}`,
                'Content-Type': 'application/json'
            }
        }
    );

    if (!response.data.ok) {
        throw new Error(`Slack API feil: ${response.data.error}`);
    }

    console.log(`✅ Slack-melding sendt til ${SLACK_CHANNEL}`);
    return response.data;
}

function formatChangeMessage(changes) {
    if (changes.length === 0) return null;

    let message = `*🏥 Askøy Fastlege Oppdatering*\n\n`;
    message += `Følgende endringer er oppdaget:\n\n`;

    // Grupper endringer etter type
    // Fix 2: For status_change og capacity_change på samme lege — vis legen én gang med begge endringer
    const newLeger = changes.filter(c => c.change_type === 'new');
    const removedLeger = changes.filter(c => c.change_type === 'removed');
    const statusChanges = changes.filter(c => c.change_type === 'status_change');
    const capacityChanges = changes.filter(c => c.change_type === 'capacity_change');

    // Nye leger
    if (newLeger.length > 0) {
        message += `*✨ Nye leger (${newLeger.length}):*\n`;
        newLeger.forEach(c => {
            message += `\n• *${c.fastlege_name || 'Ukjent'}*\n`;
            message += `  📍 ${c.fastlege_address || 'Ingen adresse'}\n`;
            message += `  📊 Status: ${c.new_value || 'Ukjent'}`;
            if (c.new_value === 'Ledig' && c.fastlege_capacity) {
                message += ` — ${c.fastlege_capacity} ledige plasser`;
            }
            message += `\n`;
        });
        message += `\n`;
    }

    // Forsvunnet leger
    if (removedLeger.length > 0) {
        message += `*❌ Leger som har forsvunnet (${removedLeger.length}):*\n`;
        removedLeger.forEach(c => {
            message += `\n• *${c.fastlege_name || 'Ukjent'}*\n`;
            message += `  📍 ${c.fastlege_address || 'Ingen adresse'}\n`;
        });
        message += `\n`;
    }

    // Fix 2: Kombiner status- og kapasitet-endringer per lege
    const allChangedIds = new Set([
        ...statusChanges.map(c => c.fastlege_id),
        ...capacityChanges.map(c => c.fastlege_id)
    ]);

    if (allChangedIds.size > 0) {
        message += `*🔄 Endringer (${allChangedIds.size} leger):*\n`;
        for (const id of allChangedIds) {
            const statusChange = statusChanges.find(c => c.fastlege_id === id);
            const capacityChange = capacityChanges.find(c => c.fastlege_id === id);
            const name = (statusChange || capacityChange).fastlege_name || 'Ukjent';
            message += `\n• *${name}*\n`;
            if (statusChange) {
                message += `  Status: "${statusChange.old_value}" → "${statusChange.new_value}"`;
                if (statusChange.new_value === 'Ledig' && capacityChange) {
                    message += ` — ${capacityChange.new_value} ledige plasser`;
                }
                message += `\n`;
            }
            if (capacityChange && !statusChange) {
                message += `  Kapasitet: "${capacityChange.old_value}" → "${capacityChange.new_value}"\n`;
            }
        }
        message += `\n`;
    }

    message += `\n🔗 <https://tjenester.helsenorge.no/bytte-fastlege?fylke=46&kommuner=4627|Se alle fastleger på Helsenorge>`;
    message += `\n📅 ${new Date().toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' })}`;

    return message;
}

// Hovedlogikk
async function detectChanges(currentData, storedData) {
    const changes = [];

    // Konverter til Map for raskere oppslag
    const storedMap = new Map(storedData.map(f => [f.id, f]));
    const currentMap = new Map(currentData.map(f => [f.id, f]));

    // Finn nye leger
    for (const current of currentData) {
        if (!storedMap.has(current.id)) {
            changes.push({
                fastlegeId: current.id,
                changeType: 'new',
                oldValue: null,
                newValue: current.status,
                name: current.name,
                address: current.address,
                capacity: current.capacity
            });
        }
    }

    // Finn forsvunnet leger og endringer
    for (const stored of storedData) {
        if (!currentMap.has(stored.id)) {
            // Lege har forsvunnet
            changes.push({
                fastlegeId: stored.id,
                changeType: 'removed',
                oldValue: stored.status,
                newValue: null,
                name: stored.name,
                address: stored.address
            });
        } else {
            // Sjekk om status eller kapasitet har endret seg
            const current = currentMap.get(stored.id);

            if (stored.status !== current.status) {
                changes.push({
                    fastlegeId: stored.id,
                    changeType: 'status_change',
                    oldValue: stored.status,
                    newValue: current.status,
                    name: current.name,
                    address: current.address
                });
            }

            if (stored.capacity !== current.capacity) {
                changes.push({
                    fastlegeId: stored.id,
                    changeType: 'capacity_change',
                    oldValue: stored.capacity,
                    newValue: current.capacity,
                    name: current.name,
                    address: current.address
                });
            }
        }
    }

    return changes;
}

async function monitor() {
    console.log('=' .repeat(60));
    console.log('🏥 Askøy Fastlege Monitor');
    console.log('=' .repeat(60));
    console.log(`Startet: ${new Date().toLocaleString('nb-NO', { timeZone: 'Europe/Oslo' })}`);
    console.log('');

    try {
        // 1. Setup database
        await setupDatabase();

        // 2. Scrape nåværende data
        console.log('📡 Scraper fastlege-data...');
        const currentData = await scrapeFastleger();
        console.log(`✅ Hentet ${currentData.length} fastleger`);

        // Fix 4: Avvis suspekt lavt antall resultater for å unngå falsk "alle forsvunnet"-alarm
        if (currentData.length < MIN_EXPECTED_FASTLEGER) {
            console.error(`❌ Kun ${currentData.length} fastleger hentet — forventer minst ${MIN_EXPECTED_FASTLEGER}. Avbryter for å unngå feilaktige varsler.`);
            process.exit(1);
        }

        // 3. Hent lagrede data
        console.log('💾 Henter lagrede data...');
        const storedData = await getStoredFastleger();
        console.log(`✅ Fant ${storedData.length} lagrede fastleger`);

        // 4. Detekter endringer
        console.log('🔍 Analyserer endringer...');
        const changes = await detectChanges(currentData, storedData);
        console.log(`📊 Funnet ${changes.length} endringer`);

        // 5. Logg endringer til database — inkludert navn og adresse (Fix 1)
        if (changes.length > 0) {
            console.log('💾 Lagrer endringer...');
            for (const change of changes) {
                await logChange(
                    change.fastlegeId,
                    change.changeType,
                    change.oldValue,
                    change.newValue,
                    change.name,
                    change.address,
                    change.capacity
                );
            }
        }

        // 6. Oppdater fastleger i database
        console.log('💾 Oppdaterer database...');
        for (const fastlege of currentData) {
            await updateFastlege(fastlege);
        }

        // Slett forsvunne leger fra databasen
        const removedIds = changes
            .filter(c => c.changeType === 'removed')
            .map(c => c.fastlegeId);
        if (removedIds.length > 0) {
            await deleteFastleger(removedIds);
            console.log(`🗑️ Slettet ${removedIds.length} forsvunne leger fra database`);
        }

        // 7. Send varsler for nye endringer
        // Fix 3: markChangesNotified kalles kun hvis sendSlackMessage ikke kaster exception
        const unnotifiedChanges = await getUnnotifiedChanges();
        if (unnotifiedChanges.length > 0) {
            console.log(`📧 Sender varsler for ${unnotifiedChanges.length} endringer...`);
            const message = formatChangeMessage(unnotifiedChanges);

            if (message) {
                await sendSlackMessage(message);
                await markChangesNotified(unnotifiedChanges.map(c => c.id));
            }
        } else {
            console.log('✅ Ingen nye endringer å varsle om');
        }

        console.log('');
        console.log('=' .repeat(60));
        console.log('✅ Overvåking fullført');
        console.log('=' .repeat(60));

    } catch (error) {
        console.error('❌ Kritisk feil:', error);
        process.exit(1);
    }
}

// Kjør monitor
if (require.main === module) {
    monitor()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { monitor };
