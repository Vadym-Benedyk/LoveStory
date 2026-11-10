# AWS resources (CloudFormation)

Two templates describe the AWS side of [`docs/deployment-decision.md`](../docs/deployment-decision.md):

| Template | Region | Creates |
|---|---|---|
| `certificate.yml` | us-east-1 | The ACM certificate for `<domain>`, `www.<domain>` and `cdn.<domain>` (CloudFront only reads certificates from us-east-1) |
| `app.yml` | eu-central-1 | Three private S3 buckets (site, photos, database backups), two CloudFront distributions (site, photos), two IAM users (photos, backups), the Lightsail instance (2 GB, daily snapshots, firewall, Docker installed on first boot) and its static IP |

Not created on purpose: the DNS zone and, unless you pass `HostedZoneId`, the DNS records (any DNS provider
works), IAM access keys (a key made by a stack is
readable in the stack), and the app setup on the server (that is [`deploy/`](../deploy/README.md)).

Status: both templates pass `cfn-lint`. `certificate.yml` is being deployed for `lovestory.vin` (started
2026-11-10); `app.yml` has not been deployed yet. The Lightsail IDs `small_3_0` and `ubuntu_24_04` were
confirmed in eu-central-1 on 2026-11-10.

## Before you start

You need the AWS CLI configured for your account and a domain you can edit DNS for. Check the Lightsail IDs
the template defaults to (`BundleId=small_3_0`, `BlueprintId=ubuntu_24_04`) in your region:

```bash
aws lightsail get-bundles --region eu-central-1 --query "bundles[].[bundleId,price,ramSizeInGb,cpuCount,diskSizeInGb]" --output table
aws lightsail get-blueprints --region eu-central-1 --query "blueprints[?type=='os'].[blueprintId,name]" --output text
```

## 0. DNS zone (Route 53)

An apex domain (`example.com` without `www`) can only point at CloudFront through an ALIAS record or CNAME
flattening. If your DNS provider has neither, host the zone in Route 53 ($0.50 a month): create it, then
replace the name servers at the registrar with the four it returns.

```bash
aws route53 create-hosted-zone --name example.com --caller-reference "lovestory-$(date +%s)" \
  --query "{Id:HostedZone.Id,NS:DelegationSet.NameServers}"
```

Pass the zone ID (the part after `/hostedzone/`) as `HostedZoneId` in steps 1 and 2: the stacks then create
the validation records and the site, `www`, `cdn` and `api` records themselves, and step 3 is not needed.
With another DNS provider, leave `HostedZoneId` out and create the records by hand.

## 1. Certificate

```bash
aws cloudformation deploy --region us-east-1 --stack-name lovestory-cert \
  --template-file infra/certificate.yml --parameter-overrides DomainName=example.com HostedZoneId=<zone ID>
```

The command waits until the certificate is validated, which needs the registrar to point at the Route 53
name servers already. Without `HostedZoneId`: while it waits, open the certificate in the ACM console
(us-east-1) and create the DNS validation CNAME records it lists at your DNS provider. Then read the ARN:

```bash
aws cloudformation describe-stacks --region us-east-1 --stack-name lovestory-cert --query "Stacks[0].Outputs" --output table
```

## 2. Everything else

```bash
aws cloudformation deploy --region eu-central-1 --stack-name lovestory \
  --template-file infra/app.yml --capabilities CAPABILITY_IAM \
  --parameter-overrides DomainName=example.com CertificateArn=<arn from step 1> HostedZoneId=<zone ID> SshCidr=<your IP>/32
aws cloudformation describe-stacks --region eu-central-1 --stack-name lovestory --query "Stacks[0].Outputs" --output table
```

Keep the stack name `lovestory`: the instance and static IP names derive from it. To look at the changes
before they are applied, add `--no-execute-changeset`.

## 3. DNS

Skip this with `HostedZoneId`: the stack has created the records. Otherwise the `DnsRecordsToCreate` output
lists what to create:

- `<domain>` and `www.<domain>`: ALIAS/CNAME to the site distribution (an apex domain needs a DNS provider
  that supports ALIAS or CNAME flattening, for example Route 53 or Cloudflare).
- `cdn.<domain>`: CNAME to the photo distribution.
- `api.<domain>`: A record to the static IP.

## 4. Access keys

Create them by hand, they are shown once:

```bash
aws iam create-access-key --user-name <MediaUserName output>
aws iam create-access-key --user-name <BackupUserName output>
```

The first goes into `deploy/.env` (`S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, plus `S3_BUCKET` =
`MediaBucketName` and `S3_PUBLIC_URL=https://cdn.<domain>`). The second goes into `aws configure` on the
server, for `deploy/backup.sh` with `BACKUP_S3_URI=s3://<BackupBucketName>/lovestory`.

## 5. The server

Log in over SSH with the Lightsail key and continue with [`deploy/README.md`](../deploy/README.md) from
the clone step. Docker, git and sqlite3 are installed by the launch script on first boot; if `docker` is
missing, look at `/var/log/cloud-init-output.log`.

## 6. The site

```bash
infra/deploy-client.sh example.com        # or: npm run deploy:client -- example.com
```

Run it from your machine. It reads the bucket and the distribution from the stack outputs (set
`STACK_NAME` and `STACK_REGION` if the stack has another name or region), builds the client with
`VITE_API_BASE=https://api.<domain>/api` (the type check runs first), and refuses to publish a build that
does not contain that address. Then it uploads `assets/` with a one-year `immutable` cache header, the
other files with `no-cache`, `index.html` last, and invalidates `/` and `/index.html`.

Nothing is deleted from the bucket, so a visitor who still has the previous page open can load its files;
remove old files by hand now and then if you like. Other `VITE_*` settings, such as
`VITE_GOOGLE_MAPS_EMBED`, are read from `client/.env` as usual.

## Changing things later

- Edit a template and run the same `deploy` command. Do not change these resources in the console; check
  for drift with `aws cloudformation detect-stack-drift`.
- **The instance cannot be changed in place.** The bundle, the OS image and the availability zone are not
  updatable, and a new instance name means replacement. A replaced instance starts with an empty disk, so
  the database has to be restored from a backup (see `deploy/README.md`). Changing `UserData` does nothing
  to a running instance.
- **The buckets are kept when the stack is deleted** (`DeletionPolicy: Retain`), together with the photos
  and backups in them. Delete them by hand only if you mean it.
- To adopt resources that were first created by hand, use CloudFormation's import or IaC generator; the
  certificate, the IAM access keys and DNS records are not importable.
