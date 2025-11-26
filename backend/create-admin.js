/* Create admin user for testing */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/user.model');
const { hashPassword } = require('./src/utils/password');
const config = require('./src/config/index');

async function createAdminUser() {
    try {
        // Connect to MongoDB
        await mongoose.connect(config.mongoUri);
        console.log('Connected to MongoDB');
        
        // Check if test admin already exists
        const existingTestAdmin = await User.findOne({ email: 'test@admin.com' });
        if (existingTestAdmin) {
            console.log('Test admin user already exists:', existingTestAdmin.email);
            console.log('📧 Email: test@admin.com');
            console.log('🔑 Password: TestAdmin123!');
            process.exit(0);
        }
        
        // Create test admin user
        const adminData = {
            name: 'Test Admin',
            email: 'test@admin.com',
            password: await hashPassword('TestAdmin123!'),
            role: 'admin',
            isActive: true
        };
        
        const admin = await User.create(adminData);
        console.log('✅ Test admin user created successfully!');
        console.log('📧 Email:', admin.email);
        console.log('🔑 Password: TestAdmin123!');
        console.log('👤 Role:', admin.role);
        
    } catch (error) {
        console.error('❌ Error creating admin user:', error.message);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
}

createAdminUser();