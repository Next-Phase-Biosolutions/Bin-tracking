import { PrismaClient, FacilityType, Urgency, UserRole, BinStatus } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomBytes } from 'crypto';

// ─── Supabase Admin API helpers ────────────────────────────────────────────

const SUPABASE_URL = process.env['SUPABASE_URL'];
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const ANON_KEY = process.env['SUPABASE_ANON_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    console.error('❌ Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY');
    process.exit(1);
}

function generateToken(): string {
    return randomBytes(32).toString('hex');
}

async function adminFetch(path: string, init?: RequestInit) {
    return fetch(`${SUPABASE_URL}/auth/v1/admin/${path}`, {
        ...init,
        headers: {
            Authorization: `Bearer ${SERVICE_KEY}`,
            apikey: SERVICE_KEY!,
            'Content-Type': 'application/json',
            ...(init?.headers ?? {}),
        },
    });
}

// Get all existing Auth users (paginated)
async function listAuthUsers(): Promise<Array<{ id: string; email: string }>> {
    const res = await adminFetch('users?per_page=1000');
    const json = await res.json() as { users?: Array<{ id: string; email: string }> };
    return json.users ?? [];
}

// Delete an Auth user by UUID
async function deleteAuthUser(id: string): Promise<void> {
    await adminFetch(`users/${id}`, { method: 'DELETE' });
}

// Create an Auth user with confirmed email, returns their UUID
async function createAuthUser(email: string, password: string, name: string): Promise<string> {
    const res = await adminFetch('users', {
        method: 'POST',
        body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: { name },
        }),
    });
    const data = await res.json() as { id?: string; message?: string };
    if (!res.ok || !data.id) {
        throw new Error(`Failed to create Auth user ${email}: ${JSON.stringify(data)}`);
    }
    return data.id;
}

/** Return existing Supabase Auth user id or create one — never deletes. */
async function getOrCreateAuthUser(
    email: string,
    password: string,
    name: string,
    existingAuth: Array<{ id: string; email: string }>,
): Promise<string> {
    const found = existingAuth.find((u) => u.email === email);
    if (found) {
        console.log(`  ↪ Auth user exists: ${email}`);
        return found.id;
    }
    const id = await createAuthUser(email, password, name);
    console.log(`  ✓ Created auth user: ${email}`);
    return id;
}

async function wipeDatabase(prisma: PrismaClient): Promise<void> {
    console.log('🧹 Cleaning existing data (SEED_FORCE=true)...');
    await prisma.payrollException.deleteMany();
    await prisma.payrollLineItem.deleteMany();
    await prisma.payrollRun.deleteMany();
    await prisma.settings.deleteMany();
    await prisma.attendanceEvent.deleteMany();
    await prisma.workSession.deleteMany();
    await prisma.employee.deleteMany();
    await prisma.shipment.deleteMany();
    await prisma.formTemplate.deleteMany();
    await prisma.animalRegistration.deleteMany();
    await prisma.eventLog.deleteMany();
    await prisma.binCycle.deleteMany();
    await prisma.bin.deleteMany();
    await prisma.station.deleteMany();
    await prisma.binType.deleteMany();
    await prisma.userFacility.deleteMany();
    await prisma.user.deleteMany();
    await prisma.facility.deleteMany();
}

async function wipeSeedAuthUsers(): Promise<void> {
    console.log('🔐 Removing seed Supabase Auth users (SEED_FORCE=true)...');
    const existingAuth = await listAuthUsers();
    const seedEmails = new Set(SEED_USERS.map((u) => u.email as string));
    for (const authUser of existingAuth.filter((u) => seedEmails.has(u.email))) {
        await deleteAuthUser(authUser.id);
        console.log(`  ✗ Deleted auth user: ${authUser.email}`);
    }
}

// ─── Seed data ─────────────────────────────────────────────────────────────

const SEED_USERS = [
    { email: 'admin@bintracker.com', name: 'System Admin', role: UserRole.ADMIN, password: 'Admin1234!' },
    { email: 'ops@bintracker.com', name: 'Ops Manager', role: UserRole.OPS_MANAGER, password: 'Ops1234!' },
    { email: 'driver1@bintracker.com', name: 'John Driver', role: UserRole.DRIVER, password: 'Driver1234!' },
    { email: 'driver2@bintracker.com', name: 'Jane Driver', role: UserRole.DRIVER, password: 'Driver1234!' },
    { email: 'worker1@bintracker.com', name: 'Bob Worker', role: UserRole.WORKER, password: 'Worker1234!' },
] as const;

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const isProduction = process.env['NODE_ENV'] === 'production';
    const seedForce = process.env['SEED_FORCE']?.toLowerCase() === 'true';
    const seedOnlyIfEmpty = process.env['SEED_ONLY_IF_EMPTY']?.toLowerCase() === 'true';

    if (isProduction && seedForce) {
        console.error('❌ SEED_FORCE is not allowed when NODE_ENV=production');
        process.exit(1);
    }

    if (isProduction && !seedOnlyIfEmpty) {
        console.error('❌ Production seed requires SEED_ONLY_IF_EMPTY=true');
        process.exit(1);
    }

    const connectionString =
        process.env['DIRECT_URL'] ?? process.env['DATABASE_URL'];
    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter, log: [] });

    if (seedOnlyIfEmpty) {
        const existing = await prisma.user.findFirst();
        if (existing) {
            console.log('✅ Database already seeded — skipping (SEED_ONLY_IF_EMPTY=true)');
            await prisma.$disconnect();
            return;
        }
    } else if (!seedForce && (await prisma.user.findFirst())) {
        console.error(
            '❌ Database is not empty. Set SEED_ONLY_IF_EMPTY=true to skip, or SEED_FORCE=true (dev only) to wipe first.',
        );
        process.exit(1);
    }

    if (seedForce) {
        await wipeDatabase(prisma);
        await wipeSeedAuthUsers();
    }

    // ─── Default org for all seeded tenant data (same pattern as backfill-org.ts) ───
    const org = await prisma.organization.upsert({
        where: { slug: 'default' },
        update: {},
        create: { name: 'Default Organization', slug: 'default' },
    });

    // ─── Supabase Auth users → get or create (never delete in bootstrap mode) ─
    console.log('👤 Ensuring Supabase Auth users...');
    const existingAuth = await listAuthUsers();
    const authIds: Record<string, string> = {};
    for (const u of SEED_USERS) {
        authIds[u.email] = await getOrCreateAuthUser(
            u.email,
            u.password,
            u.name,
            existingAuth,
        );
    }

    // ─── Mirror users in our DB using Supabase Auth UUIDs ───
    console.log('📝 Creating database users...');
    const dbUsers = await Promise.all(
        SEED_USERS.map(u =>
            prisma.user.create({
                data: { id: authIds[u.email], email: u.email, name: u.name, role: u.role },
            }),
        ),
    );
    const [, ops, driver1, driver2] = dbUsers;

    // ─── 5. Facilities ──────────────────────────────────────────
    console.log('🏭 Creating facilities...');
    const facilities = await Promise.all([
        prisma.facility.create({ data: { name: 'Chicago Processing', type: FacilityType.PROCESSING, address: '123 Industrial Blvd, Chicago, IL 60601', lat: 41.8781, lng: -87.6298, organizationId: org.id } }),
        prisma.facility.create({ data: { name: 'Detroit Processing', type: FacilityType.PROCESSING, address: '456 Factory Ave, Detroit, MI 48201', lat: 42.3314, lng: -83.0458, organizationId: org.id } }),
        prisma.facility.create({ data: { name: 'Milwaukee Processing', type: FacilityType.PROCESSING, address: '789 Plant Rd, Milwaukee, WI 53202', lat: 43.0389, lng: -87.9065, organizationId: org.id } }),
        prisma.facility.create({ data: { name: 'Midwest Rendering', type: FacilityType.RENDERING, address: '321 Render Lane, Indianapolis, IN 46201', lat: 39.7684, lng: -86.1581, organizationId: org.id } }),
        prisma.facility.create({ data: { name: 'Great Lakes Rendering', type: FacilityType.RENDERING, address: '654 Process Way, Columbus, OH 43215', lat: 39.9612, lng: -82.9988, organizationId: org.id } }),
    ]);
    const [chicago, detroit, milwaukee] = facilities;

    // ─── 6. Assign users to facilities ──────────────────────────
    //  ADMIN has no assignments (role bypasses all facility checks)
    //  Ops Manager → Chicago + Detroit
    //  Driver1     → Chicago
    //  Driver2     → Detroit + Milwaukee
    console.log('🔗 Assigning users to facilities...');
    await Promise.all([
        prisma.userFacility.create({ data: { userId: ops!.id, facilityId: chicago!.id } }),
        prisma.userFacility.create({ data: { userId: ops!.id, facilityId: detroit!.id } }),
        prisma.userFacility.create({ data: { userId: driver1!.id, facilityId: chicago!.id } }),
        prisma.userFacility.create({ data: { userId: driver2!.id, facilityId: detroit!.id } }),
        prisma.userFacility.create({ data: { userId: driver2!.id, facilityId: milwaukee!.id } }),
    ]);

    // ─── 7. Stations (scanning tablets) ─────────────────────────
    console.log('📟 Creating stations...');
    await Promise.all([
        prisma.station.create({ data: { facilityId: chicago!.id, token: generateToken(), label: 'Chicago Tablet 1' } }),
        prisma.station.create({ data: { facilityId: chicago!.id, token: generateToken(), label: 'Chicago Tablet 2' } }),
        prisma.station.create({ data: { facilityId: detroit!.id, token: generateToken(), label: 'Detroit Tablet 1' } }),
        prisma.station.create({ data: { facilityId: milwaukee!.id, token: generateToken(), label: 'Milwaukee Tablet 1' } }),
    ]);

    // ─── 8. Bin Types ────────────────────────────────────────────
    console.log('📦 Creating bin types...');
    const binTypes = await Promise.all([
        prisma.binType.create({ data: { organType: 'heart', dkHours: 4, urgency: Urgency.CRITICAL, prefix: 'BIN-HEART', masterQrCode: 'TYPE-HEART', organizationId: org.id } }),
        prisma.binType.create({ data: { organType: 'liver', dkHours: 6, urgency: Urgency.CRITICAL, prefix: 'BIN-LIVER', masterQrCode: 'TYPE-LIVER', organizationId: org.id } }),
        prisma.binType.create({ data: { organType: 'kidney', dkHours: 12, urgency: Urgency.MEDIUM, prefix: 'BIN-KIDNEY', masterQrCode: 'TYPE-KIDNEY', organizationId: org.id } }),
        prisma.binType.create({ data: { organType: 'skin', dkHours: 24, urgency: Urgency.STANDARD, prefix: 'BIN-SKIN', masterQrCode: 'TYPE-SKIN', organizationId: org.id } }),
        prisma.binType.create({ data: { organType: 'fat', dkHours: 24, urgency: Urgency.STANDARD, prefix: 'BIN-FAT', masterQrCode: 'TYPE-FAT', organizationId: org.id } }),
        prisma.binType.create({ data: { organType: 'bone', dkHours: 48, urgency: Urgency.LOW, prefix: 'BIN-BONE', masterQrCode: 'TYPE-BONE', organizationId: org.id } }),
    ]);

    // ─── 9. Bins ─────────────────────────────────────────────────
    console.log('🗑️  Creating bins...');
    const binData: Array<[number, number, number]> = [
        // [binTypeIdx, facilityIdx, serialNo]
        // Chicago — 8 bins
        [0, 0, 1], [0, 0, 2], [1, 0, 1], [2, 0, 1], [3, 0, 1], [4, 0, 1], [5, 0, 1], [5, 0, 2],
        // Detroit — 6 bins
        [0, 1, 3], [1, 1, 2], [2, 1, 2], [3, 1, 2], [4, 1, 2], [5, 1, 3],
        // Milwaukee — 6 bins
        [0, 2, 4], [1, 2, 3], [2, 2, 3], [3, 2, 3], [4, 2, 3], [5, 2, 4],
    ];

    await Promise.all(
        binData.map(([t, f, n]) =>
            prisma.bin.create({
                data: {
                    qrCode: `${binTypes[t]!.prefix}-${String(n).padStart(3, '0')}`,
                    binTypeId: binTypes[t]!.id,
                    currentFacilityId: facilities[f]!.id,
                    status: BinStatus.IDLE,
                    organizationId: org.id,
                },
            }),
        ),
    );

    // ─── Form Templates (the 4 digitized forms) ─────────────
    console.log('📋 Seeding form templates...');
    const existingFormCount = await prisma.formTemplate.count();
    if (existingFormCount === 0) {
        await prisma.formTemplate.createMany({
        data: [
            {
                organizationId: org.id,
                title: 'Customer Complaint Investigation Form',
                description: 'Record and investigate product or service complaints from customers.',
                stage: 'QUALITY',
                formType: 'standard',
                sortOrder: 0,
                schema: {
                    formType: 'standard',
                    sections: [
                        {
                            id: 'header',
                            title: null,
                            fields: [
                                { id: 'date', type: 'date', label: 'Date', required: true },
                                { id: 'time', type: 'time', label: 'Time', required: true },
                                { id: 'complaint_number', type: 'text', label: 'Complaint Number', required: true },
                                { id: 'initiated_by', type: 'text', label: 'Initiated By', required: true },
                            ],
                        },
                        {
                            id: 'section1',
                            title: 'Section 1 - Customer Details',
                            fields: [
                                { id: 'customer_name', type: 'text', label: 'Customer Name', required: true },
                                { id: 'customer_address', type: 'textarea', label: 'Customer Address', required: false },
                                { id: 'telephone', type: 'text', label: 'Telephone Number', required: false },
                                { id: 'fax', type: 'text', label: 'Fax Number', required: false },
                                { id: 'contact_name', type: 'text', label: 'Contact Name', required: false },
                                { id: 'email', type: 'text', label: 'E-Mail Address', required: false },
                            ],
                        },
                        {
                            id: 'section2',
                            title: 'Section 2 - Product Details',
                            fields: [
                                { id: 'product_name', type: 'text', label: 'Product Name', required: true },
                                { id: 'product_code', type: 'text', label: 'Product Code', required: false },
                                { id: 'best_before_date', type: 'date', label: 'Best Before or Production Date', required: false },
                                { id: 'packaging_type', type: 'text', label: 'Packaging Type (e.g. MAP, vacuum packaged)', required: false },
                                { id: 'date_of_purchase', type: 'date', label: 'Date of Purchase or Receipt', required: false },
                                { id: 'location_of_purchase', type: 'text', label: 'Location of Purchase', required: false },
                                { id: 'amount_affected', type: 'text', label: 'Amount Affected', required: false },
                                { id: 'amount_remaining', type: 'text', label: 'Amount Remaining', required: false },
                                { id: 'disposition', type: 'textarea', label: 'Disposition of the Remaining Product', required: false },
                            ],
                        },
                        {
                            id: 'section3',
                            title: 'Section 3 - Nature of the Complaint',
                            fields: [
                                {
                                    id: 'complaint_type',
                                    type: 'radio',
                                    label: 'Please choose one of the following',
                                    required: true,
                                    options: [
                                        'Out of Spec',
                                        'Packaging Compromised',
                                        'Labelling',
                                        'Off condition',
                                        'Foreign Material',
                                        'Taste',
                                        'Allergic Reaction',
                                        'Illness or Injury',
                                        'Other',
                                    ],
                                },
                                { id: 'other_description', type: 'textarea', label: 'If Other — Please Describe', required: false },
                            ],
                        },
                        {
                            id: 'section4',
                            title: 'Section 4 - Illness Details',
                            showIf: { fieldId: 'complaint_type', values: ['Allergic Reaction', 'Illness or Injury'] },
                            fields: [
                                { id: 'consumed_when', type: 'text', label: 'When was the product consumed?', required: false },
                                { id: 'amount_consumed', type: 'text', label: 'Amount of product consumed', required: false },
                                { id: 'consumed_before', type: 'yes_no', label: 'Has the product been consumed before?', required: false },
                                { id: 'persons_consuming', type: 'number', label: 'Number of persons consuming the product', required: false },
                                { id: 'persons_ill', type: 'number', label: 'Number of persons ill', required: false },
                                { id: 'time_ill', type: 'text', label: 'Time persons became ill', required: false },
                                { id: 'medical_professional', type: 'yes_no', label: 'Has a medical professional been consulted?', required: false },
                                { id: 'illness_status', type: 'text', label: 'Current Status of Illness', required: false },
                                { id: 'persons_ill_names', type: 'textarea', label: 'Names and Ages of persons ill', required: false },
                                { id: 'symptoms', type: 'textarea', label: 'Symptoms of illness in order of occurrence', required: false },
                                { id: 'followup_required', type: 'yes_no', label: 'Any follow-up required?', required: false },
                            ],
                        },
                        {
                            id: 'section5',
                            title: 'Section 5 - Injury Details',
                            showIf: { fieldId: 'complaint_type', values: ['Illness or Injury'] },
                            fields: [
                                { id: 'injury_nature', type: 'textarea', label: 'Nature of Injury', required: false },
                                { id: 'injury_status', type: 'text', label: 'Current Status of Injury', required: false },
                                { id: 'injury_medical', type: 'yes_no', label: 'Has a medical professional been consulted?', required: false },
                                { id: 'injury_followup', type: 'yes_no', label: 'Any follow-up required?', required: false },
                            ],
                        },
                        {
                            id: 'section6',
                            title: 'Section 6 - Investigation Details',
                            fields: [
                                { id: 'investigation_date', type: 'date', label: 'Date', required: false },
                                { id: 'investigation_time', type: 'time', label: 'Time', required: false },
                                { id: 'completed_by', type: 'text', label: 'Completed By', required: false },
                                { id: 'onsite_results', type: 'textarea', label: 'Results of On-Site Investigation', required: false },
                                { id: 'records_results', type: 'textarea', label: 'Results of Records Review', required: false },
                                { id: 'micro_results', type: 'textarea', label: 'Results of Micro Review if Required', required: false },
                            ],
                        },
                        {
                            id: 'section7',
                            title: 'Section 7 - Food Safety Assessment',
                            fields: [
                                { id: 'food_safety_compromised', type: 'yes_no', label: 'Has food safety been compromised?', required: false },
                                { id: 'other_products_affected', type: 'yes_no', label: 'Are any other products affected by the complaint?', required: false },
                            ],
                        },
                        {
                            id: 'section8',
                            title: 'Section 8 - Corrective Actions',
                            fields: [
                                { id: 'immediate_actions', type: 'textarea', label: 'Immediate Corrective Actions', required: false },
                                { id: 'preventive_measures', type: 'textarea', label: 'Preventive Measures', required: false },
                            ],
                        },
                        {
                            id: 'section9',
                            title: 'Section 9 - Communication',
                            fields: [
                                { id: 'referred_to', type: 'textarea', label: 'Has the complaint been referred to anyone else? (e.g. Public Health, CFIA)', required: false },
                                { id: 'response_sent', type: 'date', label: 'Date Response sent to Customer', required: false },
                            ],
                        },
                    ],
                },
            },
            {
                organizationId: org.id,
                title: 'Allergen Checklist',
                description: 'Supplier allergen declaration — identify allergens present in product, on same line, and in plant.',
                stage: 'RECEIVING',
                formType: 'matrix',
                sortOrder: 0,
                schema: {
                    formType: 'matrix',
                    headerFields: [
                        { id: 'supplier_name', type: 'text', label: 'Supplier Name', required: true },
                        { id: 'completed_by', type: 'text', label: 'Form Completed By', required: true },
                        { id: 'product_name', type: 'text', label: 'Product Name', required: true },
                        { id: 'product_code', type: 'text', label: 'Product Code', required: false },
                    ],
                    columns: [
                        { id: 'col_product', label: 'Present in the product' },
                        { id: 'col_same_line', label: 'Present in other products on same line' },
                        { id: 'col_same_plant', label: 'Present in same plant' },
                    ],
                    rows: [
                        { id: 'peanut', label: 'Peanut or its derivatives (pieces, protein, oil, butter, flour, mandelona nuts)' },
                        { id: 'tree_nuts', label: 'Tree Nuts (almonds, Brazil nuts, cashews, hazelnuts, macadamia, pecans, pine nuts, pistachios, walnuts)' },
                        { id: 'sesame', label: 'Sesame or its derivatives (paste, oil)' },
                        { id: 'milk', label: 'Milk or its derivatives (caseinate, whey, yogurt powder)' },
                        { id: 'eggs', label: 'Eggs or its derivatives (frozen yolk, egg white powder, protein isolates)' },
                        { id: 'fish', label: 'Fish or its derivatives (protein, oil, extracts)' },
                        { id: 'crustaceans', label: 'Crustaceans & Shellfish (crab, crayfish, lobster, shrimp, clams, mussels, oysters)' },
                        { id: 'soy', label: 'Soy or its derivatives (lecithin, oil, tofu, protein isolates)' },
                        { id: 'wheat', label: 'Wheat, triticale or derivatives (flour, starches, brans, spelt, durum, kamut)' },
                        { id: 'mustard', label: 'Mustard or its derivatives (seeds, flour, ground mustard, prepared mustard)' },
                    ],
                    footerFields: [
                        {
                            id: 'cross_contam_procedures',
                            type: 'yes_no',
                            label: 'Do you have effective procedures to avoid cross-contamination with allergens not present in the product but noted in columns II and III?',
                            required: true,
                        },
                    ],
                },
            },
            {
                organizationId: org.id,
                title: 'Equipment Review Form',
                description: 'Evaluate equipment, instruments, measuring devices, and food contact surfaces against compliance criteria.',
                stage: 'MAINTENANCE',
                formType: 'checklist',
                sortOrder: 0,
                schema: {
                    formType: 'checklist',
                    headerFields: [
                        { id: 'person_responsible', type: 'text', label: 'Person Responsible', required: true },
                        { id: 'date', type: 'date', label: 'Date', required: true },
                        { id: 'equipment_name', type: 'text', label: 'Equipment Name', required: true },
                        { id: 'model_number', type: 'text', label: 'Model Number', required: false },
                        { id: 'supplier', type: 'text', label: 'Equipment Supplier / Manufacturer', required: false },
                        { id: 'installation_date', type: 'date', label: 'Date of Installation or Use', required: false },
                        { id: 'location_purpose', type: 'text', label: 'Location or Purpose', required: false },
                    ],
                    groups: [
                        {
                            id: 'equipment_group',
                            title: 'Equipment, Instruments and Measuring Devices',
                            items: [
                                { id: 'c9_04_15_01_01', label: '(C9.04.15.01.01) Equipment, instruments and measuring devices are designed in a manner that prevents contamination of meat products.' },
                                { id: 'c9_04_15_01_02', label: '(C9.04.15.01.02) Constructed of materials that are corrosion resistant, do not transmit odour or taste, and are free of constituents likely to contaminate meat.' },
                                { id: 'c9_04_15_01_03', label: '(C9.04.15.01.03) Located and installed in a manner that prevents contamination of meat products and allows for effective cleaning and sanitizing.' },
                                { id: 'c9_04_15_02_01', label: '(C9.04.15.02.01) Each piece of equipment or utensil is effective for its intended purpose.' },
                            ],
                        },
                        {
                            id: 'food_contact',
                            title: 'Food Contact Surfaces',
                            items: [
                                { id: 'c9_04_15_05_01', label: '(C9.04.15.05.01) They are non-absorbent, corrosion resistant and non-toxic.' },
                                { id: 'c9_04_15_05_02', label: '(C9.04.15.05.02) They are designed and constructed to be free of niches for accumulation of food debris and microbial growth.' },
                                { id: 'c9_04_15_05_03', label: '(C9.04.15.05.03) They are smooth and free from pitting, cracks and chipping.' },
                                { id: 'c9_04_15_05_04', label: '(C9.04.15.05.04) They are capable of withstanding repeated cleaning and sanitizing.' },
                            ],
                        },
                        {
                            id: 'shelving',
                            title: 'Shelving and Racks',
                            items: [
                                { id: 'c9_04_15_06_01', label: '(C9.04.15.06.01) Shelves and racks are designed, constructed, located, installed, and maintained to facilitate sanitary operation, with sufficient clearance from floor for cleaning.' },
                            ],
                        },
                        {
                            id: 'inedible',
                            title: 'Inedible Equipment',
                            items: [
                                { id: 'c9_04_15_07_02', label: '(C9.04.15.07.02) All equipment used for inedible material intended for pet food or pharmaceutical use allows hygienic processing, packaging and labelling.' },
                                { id: 'c9_04_15_07_03', label: '(C9.04.15.07.03) Equipment for inedible material is in good condition and made of durable materials that can be cleaned and sanitized.' },
                            ],
                        },
                        {
                            id: 'records',
                            title: 'Records',
                            items: [
                                { id: 'rec_01', label: "Operator's manual has been received (includes cleaning, maintenance, and installation instructions)." },
                                { id: 'rec_02', label: 'Equipment added to the Maintenance Schedule / Record.' },
                                { id: 'rec_03', label: 'Equipment added to the Sanitation Schedule.' },
                                { id: 'rec_04', label: 'Equipment added to the Pre-Operational Inspection.' },
                                { id: 'rec_05', label: 'Instruments and Measuring Devices added to the Calibration Schedule / Record.' },
                            ],
                        },
                    ],
                },
            },
            {
                organizationId: org.id,
                title: 'Plant Receiving Record — Meat & Non-Meat',
                description: 'Document all product and supplier information for each delivery received.',
                stage: 'RECEIVING',
                formType: 'repeating',
                sortOrder: 1,
                schema: {
                    formType: 'repeating',
                    instructions: [
                        '1. Inspect the sanitary and structural condition of the transport vehicle. Ensure no objectionable odours, contamination, or temperature abuse. Check: clean and free of contamination; constructed of safe materials; hard, smooth, impervious interior surfaces in good repair.',
                        '2. Check the transport container can maintain 4°C or less for fresh product and -18°C or less for frozen.',
                        '3. If applicable, randomly check the temperature of the product.',
                        '4. Visually evaluate product condition — no contamination, spoilage, damage, temperature abuse, or tampering (open boxes, broken straps, puncture holes).',
                    ].join('\n'),
                    columns: [
                        { id: 'date', type: 'date', label: 'Date', required: true },
                        { id: 'supplier_name', type: 'text', label: 'Supplier Name', required: true },
                        { id: 'lot_number', type: 'text', label: 'Supplier / Company Lot #', required: false },
                        { id: 'product_name', type: 'text', label: 'Product Name', required: true },
                        { id: 'quantity', type: 'number', label: 'Quantity', required: true },
                        { id: 'product_temp', type: 'number', label: 'Product Temp (°C)', required: true },
                        { id: 'product_condition', type: 'select', label: 'Condition of Product', required: true, options: ['Satisfactory', 'Unsatisfactory'] },
                        { id: 'truck_temp', type: 'number', label: 'Truck Temp', required: true },
                        { id: 'truck_condition', type: 'select', label: 'Condition of Truck', required: true, options: ['Satisfactory', 'Unsatisfactory'] },
                        { id: 'comments', type: 'textarea', label: 'Comments / Corrective Actions', required: false },
                        { id: 'initials', type: 'text', label: 'Initials', required: true },
                    ],
                },
            },
        ],
        });
        console.log('  ✓ 4 form templates seeded');
    } else {
        console.log(`  ↪ ${existingFormCount} form templates already present — skipping`);
    }

    // ─── Done — print test guide ──────────────────────────────────
    console.log('\n✅ Seed complete!\n');    console.log('═══════════════════════════════════════════════════════════');
    console.log('  TEST ACCOUNTS');
    console.log('═══════════════════════════════════════════════════════════');
    for (const u of SEED_USERS) {
        console.log(`  ${u.role.padEnd(12)} │ ${u.email.padEnd(30)} │ ${u.password}`);
    }
    console.log('───────────────────────────────────────────────────────────');
    console.log('  FACILITY ACCESS');
    console.log('───────────────────────────────────────────────────────────');
    console.log('  ADMIN       → all facilities (no restriction)');
    console.log('  OPS_MANAGER → Chicago + Detroit');
    console.log('  driver1     → Chicago only');
    console.log('  driver2     → Detroit + Milwaukee');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('\n  Get a JWT (run in terminal):');
    console.log(`\n  curl -s -X POST '${SUPABASE_URL}/auth/v1/token?grant_type=password' \\`);
    console.log(`    -H 'apikey: ${ANON_KEY}' \\`);
    console.log(`    -H 'Content-Type: application/json' \\`);
    console.log(`    -d '{"email":"admin@bintracker.com","password":"Admin1234!"}' | jq .access_token`);
    console.log('\n  Then call the API:');
    console.log(`  curl -s http://localhost:3001/trpc/facility.list \\`);
    console.log(`    -H 'Authorization: Bearer <access_token>'`);
    console.log('');

    await prisma.$disconnect();
}

main().catch(e => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
});
