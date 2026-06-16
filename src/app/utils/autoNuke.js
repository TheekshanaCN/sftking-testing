import cron from 'node-cron';
import fs from 'fs';
import path from 'path';
import { Op } from 'sequelize';

export default function startAutoNuke(WrittenResultModel, baseUploadDir) {
    // This cron schedule runs every night at 3:00 AM
    cron.schedule('0 3 * * *', async () => {
        console.log('🧹 [CRON] Waking up... Scanning for 48-hour old exam files to nuke...');

        try {
            // Calculate exactly 48 hours ago
            const twoDaysAgo = new Date();
            twoDaysAgo.setHours(twoDaysAgo.getHours() - 48);

            // 1. Find all exams graded over 48 hours ago that haven't been wiped yet
            const oldExams = await WrittenResultModel.findAll({
                where: {
                    gradingStatus: { [Op.in]: ['graded', 'published'] }, // Target graded papers
                    updatedAt: { [Op.lte]: twoDaysAgo },                 // Older than 48 hours
                    fileUrls: { [Op.ne]: '[]' }                          // Still has files attached!
                }
            });

            if (oldExams.length === 0) {
                console.log('🛡️ [CRON] Vault is clean. No files need nuking today.');
                return;
            }

            console.log(`🎯 [CRON] Found ${oldExams.length} old exams. Initiating Nuke...`);

            // 2. Loop through each exam and delete the physical files
            for (const exam of oldExams) {
                let fileUrls = [];
                try {
                    fileUrls = JSON.parse(exam.fileUrls);
                } catch (e) {
                    continue; // Skip if JSON is broken
                }

                if (Array.isArray(fileUrls) && fileUrls.length > 0) {
                    for (const fileUrl of fileUrls) {
                        // Your DB saves it as: "/uploads/written-answers/filename.jpg"
                        // We extract just the filename
                        const filename = path.basename(fileUrl);
                        
                        // Construct the exact absolute path on the VPS
                        const filePath = path.join(baseUploadDir, filename);
                        
                        // Check if file exists, then execute the deletion
                        if (fs.existsSync(filePath)) {
                            fs.unlinkSync(filePath); 
                            console.log(`💥 Nuked: ${filename}`);
                        }
                    }
                }

                // 3. WIPE the database record's image array so it never triggers again!
                exam.fileUrls = '[]'; 
                await exam.save();
            }

            console.log('✅ [CRON] Auto-Nuke complete. Server space restored!');

        } catch (error) {
            console.error('❌ [CRON] Nuke sequence failed:', error);
        }
    });
}