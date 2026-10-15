# Store originals and converted files in S3

Bucket: `gold-storage-285114430162-us-east-1-an`.
Region: `us-east-1` (inferred from the name; confirm in the S3 console).

## Enable on EC2

1. Attach [iam/ec2-s3-policy.json](iam/ec2-s3-policy.json) as an additional inline
   policy on the **EC2 instance role**, preserving its existing SSM/ECR policies.
   It grants only `s3:PutObject` under this bucket's `chameleon/` prefix.
   The GitHub deployment role does not need S3 access.
2. Keep S3 Block Public Access enabled. Confirm no lifecycle expiration rule
   applies to `chameleon/`, since files should remain until manually deleted.
   If the bucket uses a customer-managed KMS key, its key policy and the instance
   role must also allow the required encryption operation (`kms:GenerateDataKey`).
3. Enable the EC2 metadata endpoint with IMDSv2 required and a response hop limit
   of `2` for Docker bridge networking. The SDK uses the instance role through
   its [default credential chain](https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/setting-credentials-node.html).
   See AWS's [container metadata guidance](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instancedata-data-retrieval.html).
4. Add these lines to `/home/admin/chameleon/backend/.env` on EC2:

   ```dotenv
   STORAGE_DRIVER=s3
   S3_BUCKET=gold-storage-285114430162-us-east-1-an
   S3_REGION=us-east-1
   ```

5. Deploy the updated backend through the existing CI/CD workflow. The production
   Compose configuration already passes this environment file into the API.
   Updating the example file in Git alone does not change the EC2 environment file.

No access keys need to be added to the application environment. The instance
needs HTTPS connectivity to S3, and any bucket or VPC endpoint policy must permit
the writes. The bucket's encryption defaults apply to new objects.

## What is stored

```text
chameleon/YYYY-MM-DD/<unique-conversion-id>/
  originals/1-photo.png
  converted/1-photo.webp
```

Validated originals are stored before conversion. Converted outputs are stored
before the API returns success. PDF-to-image saves every output page. Batch
conversion gives each source file its own group; merged PDFs keep all inputs and
the single output together. Numbered filenames prevent duplicate-name collisions.

Batch ZIP downloads are still generated for the browser; S3 stores their converted
files individually, not an extra ZIP copy. Rejected uploads are not archived.
There are no public object URLs or new browser S3 requests, so bucket CORS is not
needed for this server-side integration.

S3 copies are retained indefinitely by the application. Local temporary uploads
are still cleaned up. `RETENTION_MINUTES` affects local files only. The app role
has no delete permission; use your administrator access to manually delete files
in S3. Versioned buckets may retain older versions after deletion.

If storage fails, a single/merge request returns HTTP 503. A batch records a
per-file failure in `errors.json` and omits that file's outputs from the ZIP.
Already-written objects remain if a later write or conversion fails; there is
no automatic rollback/delete. Retrying creates a new group.

## Verify

After deployment, convert an image, run a batch, and merge two images into a PDF.
Check the downloads and inspect the bucket's `chameleon/` prefix in the S3 console
for the originals and outputs. Download an object there to confirm its contents.
History continues to track conversions as before; this change does not add
download-from-history links or an S3 file browser.

For `AccessDenied`, check the instance role, bucket policy, endpoint policy, and
KMS permissions. For missing credentials inside Docker, check metadata endpoint
access and the hop limit. For region errors, confirm the bucket's actual region.

Local development defaults to `STORAGE_DRIVER=local`. To test against S3 locally,
set the S3 variables in `backend/.env` and use your normal AWS credential profile.
Automated tests mock S3 and never upload to the production bucket.
