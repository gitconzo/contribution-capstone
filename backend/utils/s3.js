// backend/utils/s3.js
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.S3_BUCKET;

// Generate a presigned URL for uploading a file from the browser
async function getPresignedUploadUrl(key, contentType) {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType || "application/octet-stream",
  });
  return getSignedUrl(s3, command, { expiresIn: 60 });
}

// Generate a presigned URL for downloading/viewing a file
async function getPresignedDownloadUrl(key) {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(s3, command, { expiresIn: 3600 });
}

// Download an S3 object to a local path (used by parsers)
async function downloadToFile(key, localPath) {
  const fs = require("fs");
  const { Readable } = require("stream");
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const response = await s3.send(command);
  await new Promise((resolve, reject) => {
    const stream = response.Body;
    const writer = fs.createWriteStream(localPath);
    Readable.from(stream).pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

// Upload a local file to S3
async function uploadFile(key, localPath, contentType) {
  const fs = require("fs");
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: fs.createReadStream(localPath),
    ContentType: contentType || "application/octet-stream",
  });
  return s3.send(command);
}

async function deleteFile(key) {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });
  return s3.send(command);
}

// Fetch an S3 object directly into memory and parse it as JSON.
// Returns the parsed value, or null if the key is missing / unreadable.
async function getObjectAsJson(key) {
  if (!key) return null;
  try {
    const command  = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await s3.send(command);
    const body     = await response.Body.transformToString();
    return JSON.parse(body);
  } catch {
    return null;
  }
}

module.exports = {
  s3,
  BUCKET,
  getPresignedUploadUrl,
  getPresignedDownloadUrl,
  downloadToFile,
  uploadFile,
  deleteFile,
  getObjectAsJson,
};
