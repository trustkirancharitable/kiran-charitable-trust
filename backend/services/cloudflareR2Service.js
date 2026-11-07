const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Cloudflare R2 Configuration
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'kiran-charitable-trust-photos';
const R2_PUBLIC_DOMAIN = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || ''; // e.g. https://media.kirancharitabletrust.org or https://pub-xxxx.r2.dev

let s3Client = null;

function getR2Client() {
    if (!s3Client && R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY) {
        s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: R2_ACCESS_KEY_ID,
                secretAccessKey: R2_SECRET_ACCESS_KEY
            }
        });
    }
    return s3Client;
}

/**
 * Uploads a user photo to Cloudflare R2 (with local disk fallback for dev)
 * @param {Buffer} buffer - File buffer
 * @param {string} fileName - Destination filename
 * @param {string} mimeType - File mimetype (e.g. image/jpeg, image/png)
 * @returns {Promise<string>} - The public image URL
 */
async function uploadPhotoToR2(buffer, fileName, mimeType) {
    const client = getR2Client();

    if (client && R2_BUCKET_NAME) {
        try {
            console.log(`☁️ [Cloudflare R2] Uploading photo ${fileName} to bucket: ${R2_BUCKET_NAME}...`);
            const command = new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: `profile_photos/${fileName}`,
                Body: buffer,
                ContentType: mimeType || 'image/jpeg'
            });

            await client.send(command);

            const publicUrl = R2_PUBLIC_DOMAIN 
                ? `${R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/profile_photos/${fileName}`
                : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/profile_photos/${fileName}`;

            console.log(`✅ [Cloudflare R2] Photo saved successfully: ${publicUrl}`);
            return publicUrl;
        } catch (err) {
            console.warn(`⚠️ [Cloudflare R2 Upload Notice] ${err.message}. Falling back to local storage.`);
        }
    }

    // Local Disk Fallback
    const uploadDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localFilePath = path.join(uploadDir, fileName);
    fs.writeFileSync(localFilePath, buffer);
    console.log(`💾 [Local Fallback] Stored photo locally at: /uploads/${fileName}`);
    return `/uploads/${fileName}`;
}

module.exports = {
    uploadPhotoToR2,
    getR2Client
};
