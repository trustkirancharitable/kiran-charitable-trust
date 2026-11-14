let S3Client = null;
let PutObjectCommand = null;
let GetObjectCommand = null;
let DeleteObjectCommand = null;
let ListObjectsV2Command = null;

try {
    const s3 = require('@aws-sdk/client-s3');
    S3Client = s3.S3Client;
    PutObjectCommand = s3.PutObjectCommand;
    GetObjectCommand = s3.GetObjectCommand;
    DeleteObjectCommand = s3.DeleteObjectCommand;
    ListObjectsV2Command = s3.ListObjectsV2Command;
} catch (e) {
    // Graceful fallback if @aws-sdk/client-s3 is not installed
}

const fs = require('fs');
const path = require('path');

// Cloudflare R2 Configuration
const R2_ACCOUNT_ID = process.env.CLOUDFLARE_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.CLOUDFLARE_R2_BUCKET_NAME || 'trustholdersimages';
const R2_PUBLIC_DOMAIN = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN || 'https://pub-970bc89c732845808ebd2b74e9d1e0fd.r2.dev';

let s3Client = null;

function getR2Client() {
    if (!S3Client) return null;
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

/**
 * Uploads an event gallery image to Cloudflare R2 under the gallery/ prefix
 * Structure: gallery/{eventSlug}/{fileName}
 * @param {Buffer} buffer - File buffer
 * @param {string} eventSlug - Sanitized event slug (e.g. 'educational-support-programme')
 * @param {string} fileName - Unique filename
 * @param {string} mimeType - File mimetype (image/jpeg, image/png, image/webp)
 * @returns {Promise<{ publicUrl: string, r2Key: string }>}
 */
async function uploadGalleryImageToR2(buffer, eventSlug, fileName, mimeType) {
    const safeSlug = (eventSlug || 'general').replace(/[^a-zA-Z0-9_-]/g, '-').toLowerCase();
    const r2Key = `gallery/${safeSlug}/${fileName}`;
    const client = getR2Client();

    if (client && R2_BUCKET_NAME) {
        try {
            console.log(`☁️ [Cloudflare R2 Gallery] Uploading ${r2Key} (${buffer.length} bytes)...`);
            const command = new PutObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: r2Key,
                Body: buffer,
                ContentType: mimeType || 'image/jpeg',
                CacheControl: 'public, max-age=31536000, immutable'
            });

            await client.send(command);

            const publicUrl = R2_PUBLIC_DOMAIN 
                ? `${R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${r2Key}`
                : `https://${R2_BUCKET_NAME}.${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${r2Key}`;

            console.log(`✅ [Cloudflare R2 Gallery] Uploaded successfully: ${publicUrl}`);
            return { publicUrl, r2Key };
        } catch (err) {
            console.warn(`⚠️ [Cloudflare R2 Gallery Upload Notice] ${err.message}. Using local storage fallback.`);
        }
    }

    // Local Disk Fallback
    const uploadDir = path.join(__dirname, '..', 'uploads', 'gallery', safeSlug);
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }
    const localFilePath = path.join(uploadDir, fileName);
    fs.writeFileSync(localFilePath, buffer);
    const localUrl = `/uploads/gallery/${safeSlug}/${fileName}`;
    console.log(`💾 [Local Fallback] Stored gallery image locally at: ${localUrl}`);
    return { publicUrl: localUrl, r2Key };
}

/**
 * Deletes an object from Cloudflare R2 by its object key
 * @param {string} r2Key - Object key (e.g. 'gallery/event-slug/filename.jpg')
 * @returns {Promise<boolean>}
 */
async function deleteGalleryImageFromR2(r2Key) {
    if (!r2Key) return false;
    const client = getR2Client();

    if (client && R2_BUCKET_NAME && DeleteObjectCommand) {
        try {
            console.log(`🗑️ [Cloudflare R2 Gallery] Deleting ${r2Key} from bucket ${R2_BUCKET_NAME}...`);
            const command = new DeleteObjectCommand({
                Bucket: R2_BUCKET_NAME,
                Key: r2Key
            });
            await client.send(command);
            console.log(`✅ [Cloudflare R2 Gallery] Successfully deleted: ${r2Key}`);
        } catch (err) {
            console.warn(`⚠️ [Cloudflare R2 Gallery Delete Notice] ${err.message}`);
        }
    }

    // Also remove local file if exists
    try {
        const localFilePath = path.join(__dirname, '..', r2Key.startsWith('/') ? r2Key : `uploads/${r2Key}`);
        if (fs.existsSync(localFilePath)) {
            fs.unlinkSync(localFilePath);
            console.log(`🗑️ [Local Disk] Removed local file: ${localFilePath}`);
        }
    } catch (e) {}

    return true;
}

/**
 * Lists objects in Cloudflare R2 under gallery/
 * @param {string} [eventSlug] - Optional event subfolder
 * @returns {Promise<Array<{ key: string, size: number, lastModified: Date }>>}
 */
async function listGalleryImagesFromR2(eventSlug = '') {
    const client = getR2Client();
    if (!client || !R2_BUCKET_NAME || !ListObjectsV2Command) return [];

    const prefix = eventSlug ? `gallery/${eventSlug}/` : 'gallery/';
    try {
        const command = new ListObjectsV2Command({
            Bucket: R2_BUCKET_NAME,
            Prefix: prefix
        });
        const response = await client.send(command);
        return (response.Contents || []).map(item => ({
            key: item.Key,
            size: item.Size,
            lastModified: item.LastModified,
            publicUrl: `${R2_PUBLIC_DOMAIN.replace(/\/$/, '')}/${item.Key}`
        }));
    } catch (err) {
        console.warn(`⚠️ [Cloudflare R2 List Notice] ${err.message}`);
        return [];
    }
}

module.exports = {
    uploadPhotoToR2,
    uploadGalleryImageToR2,
    deleteGalleryImageFromR2,
    listGalleryImagesFromR2,
    getR2Client
};
