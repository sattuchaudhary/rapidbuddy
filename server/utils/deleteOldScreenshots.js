const Payment = require('../models/Payment');
const fs = require('fs');
const path = require('path');

/**
 * Delete payment screenshots that are past their deletion date
 * This should be run periodically (e.g., daily via cron or setInterval)
 */
async function deleteOldScreenshots() {
  try {
    const now = new Date();
    
    // Find payments with screenshots that should be deleted
    const paymentsToClean = await Payment.find({
      screenshotUrl: { $exists: true, $ne: null, $ne: '' },
      screenshotDeleteAt: { $lte: now },
      status: 'approved'
    });

    let deletedCount = 0;
    let errorCount = 0;

    for (const payment of paymentsToClean) {
      try {
        if (payment.screenshotUrl) {
          // Extract filename from URL path
          const urlPath = payment.screenshotUrl;
          const filename = urlPath.split('/').pop();
          
          if (filename) {
            const filePath = path.join(__dirname, '..', 'uploads', 'payment_screenshots', filename);
            
            // Check if file exists and delete
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`Deleted screenshot: ${filename} for payment ${payment._id}`);
              deletedCount++;
            } else {
              console.log(`Screenshot file not found: ${filePath}`);
            }
          }
          
          // Clear screenshot URL and deletion date from payment record
          payment.screenshotUrl = null;
          payment.screenshotDeleteAt = null;
          await payment.save();
        }
      } catch (err) {
        console.error(`Error deleting screenshot for payment ${payment._id}:`, err);
        errorCount++;
      }
    }

    if (deletedCount > 0 || errorCount > 0) {
      console.log(`Screenshot cleanup completed: ${deletedCount} deleted, ${errorCount} errors`);
    }

    return { deletedCount, errorCount };
  } catch (err) {
    console.error('Error in deleteOldScreenshots:', err);
    return { deletedCount: 0, errorCount: 1 };
  }
}

module.exports = { deleteOldScreenshots };



