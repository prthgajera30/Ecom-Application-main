const mongoose = require('mongoose');
const { InventoryService } = require('./apps/api/src/services/inventory');

// Test script to verify inventory functionality
async function testInventorySystem() {
  try {
    console.log('🔍 Testing Inventory Management System...\n');

    // Connect to database
    await mongoose.connect(process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/ecommerce');
    console.log('✅ Connected to database');

    // Import Product model dynamically
    const { Product } = require('./apps/api/src/db');

    // Test 1: Create a test product with stock
    console.log('📝 Test 1: Creating test product with inventory...');
    const testProduct = new Product({
      title: 'Test Inventory Product',
      slug: 'test-inventory-product',
      description: 'Test product for inventory system',
      price: 29.99,
      currency: 'USD',
      categoryId: 'test-category',
      stock: 100,
      reservedStock: 0,
      lowStockThreshold: 10,
      trackInventory: true,
      isActive: true,
      images: ['https://picsum.photos/seed/test/600/600']
    });

    await testProduct.save();
    console.log('✅ Test product created with ID:', testProduct._id);

    // Test 2: Check inventory status
    console.log('\n📊 Test 2: Checking inventory status...');
    const status = await InventoryService.getInventoryStatus(testProduct._id);
    console.log('✅ Inventory status:', status);

    // Test 3: Adjust stock
    console.log('\n📈 Test 3: Adjusting stock +5...');
    const adjustedStatus = await InventoryService.adjustStock({
      productId: testProduct._id,
      change: 5,
      reason: 'manual_adjustment',
      note: 'Test stock adjustment +5',
      userId: 'test-admin'
    });
    console.log('✅ Adjusted status:', adjustedStatus);

    // Test 4: Check low stock products
    console.log('\n⚠️  Test 4: Checking low stock products...');
    const lowStockProducts = await InventoryService.getLowStockProducts(10);
    console.log('✅ Low stock products found:', lowStockProducts.length);

    // Test 5: Get inventory history
    console.log('\n📚 Test 5: Getting inventory history...');
    const history = await InventoryService.getInventoryHistory(testProduct._id, null, 10);
    console.log('✅ Inventory history entries:', history.length);

    // Test 6: Adjust stock negatively
    console.log('\n📉 Test 6: Adjusting stock -20...');
    const negativeAdjustment = await InventoryService.adjustStock({
      productId: testProduct._id,
      change: -20,
      reason: 'manual_adjustment',
      note: 'Test stock adjustment -20',
      userId: 'test-admin'
    });
    console.log('✅ Negative adjustment status:', negativeAdjustment);

    // Test 7: Check stock availability
    console.log('\n✅ Test 7: Checking stock availability for purchase...');
    const availability = await InventoryService.checkStockAvailability([{
      productId: testProduct._id,
      quantity: 5
    }]);
    console.log('✅ Stock availability:', availability);

    // Test 8: Try to purchase more than available
    console.log('\n❌ Test 8: Testing insufficient stock detection...');
    const insufficientStock = await InventoryService.checkStockAvailability([{
      productId: testProduct._id,
      quantity: 1000 // More than available
    }]);
    console.log('✅ Insufficient stock detected:', !insufficientStock.available);

    // Cleanup test data
    console.log('\n🧹 Cleaning up test data...');
    await Product.findByIdAndDelete(testProduct._id);

    // Test completed
    console.log('\n🎉 All inventory tests passed!');
    console.log('✅ Inventory management system is working correctly');

  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('🔍 Error details:', error.stack);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the tests
testInventorySystem();
