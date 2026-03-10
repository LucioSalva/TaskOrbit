const { getMetrics } = require('./modules/dashboard/dashboard.controller');

// Mock objects
const mockReq = (userId, role, query = {}) => ({
    user: { id: userId, rol: role },
    query: query
});

const mockRes = {
    status: (code) => ({
        json: (data) => console.log(`Response [${code}]:`, JSON.stringify(data, null, 2))
    }),
    json: (data) => console.log('Response:', JSON.stringify(data, null, 2))
};

const next = (err) => console.error('Error:', err);

async function runTests() {
    console.log('--- Test 1: Admin User (ID: 1) - No Filters ---');
    // Admin 1 didn't create project 5, so should see 0 projects (unless he created others)
    await getMetrics(mockReq(1, 'ADMIN'), mockRes, next);

    console.log('\n--- Test 2: Normal User (ID: 2) - No Filters ---');
    // User 2 should only see projects assigned to them
    await getMetrics(mockReq(2, 'USER'), mockRes, next);

    console.log('\n--- Test 3: GOD User (ID: 1) - No Filters ---');
    // GOD should see all projects
    await getMetrics(mockReq(1, 'GOD'), mockRes, next);

    console.log('\n--- Test 4: Creator Admin User (ID: 11) - No Filters ---');
    // Should return projects because ID 11 is the creator of Project 5 (from previous knowledge)
    await getMetrics(mockReq(11, 'ADMIN'), mockRes, next);

    console.log('\n--- Test 5: Creator Admin User (ID: 11) - Filter Status "por_hacer" ---');
    // Should return projects with status 'por_hacer'
    await getMetrics(mockReq(11, 'ADMIN', { status: 'por_hacer' }), mockRes, next);

    console.log('\n--- Test 6: Creator Admin User (ID: 11) - Filter No Results (Status "invalid_status") ---');
    // Should return 0 projects
    await getMetrics(mockReq(11, 'ADMIN', { status: 'status_que_no_existe' }), mockRes, next);

    console.log('\n--- Test 7: Creator Admin User (ID: 11) - Filter by Specific Project ID (Valid) ---');
    // Should return the project if they created it
    await getMetrics(mockReq(11, 'ADMIN', { projectId: 5 }), mockRes, next);

    console.log('\n--- Test 8: Admin User (ID: 1) - Access Unauthorized Project (ID: 5) ---');
    // Admin 1 did not create project 5. Even if they request it by ID, it should return empty because of the base query restriction.
    await getMetrics(mockReq(1, 'ADMIN', { projectId: 5 }), mockRes, next);
}

runTests();
