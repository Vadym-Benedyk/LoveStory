#!/usr/bin/env python3
"""Turns the access key of the SES IAM user into the SMTP_URL of the API.

SES does not accept the secret access key as an SMTP password: the password is derived from it
(algorithm: https://docs.aws.amazon.com/ses/latest/dg/smtp-credentials.html). This script reads
"<access key id> <secret access key>" from stdin, the format `aws iam create-access-key --output text
--query "AccessKey.[AccessKeyId,SecretAccessKey]"` prints, and writes the ready SMTP_URL value to stdout:

  aws iam create-access-key --user-name <SmtpUserName> --query "AccessKey.[AccessKeyId,SecretAccessKey]" \\
    --output text | python3 infra/ses-smtp-url.py eu-central-1

The secret is read from stdin, never from the command line, so it stays out of the shell history and the
process list. The URL contains the SMTP password: keep it in the server's deploy/.env only.
"""
import base64
import hashlib
import hmac
import sys
from urllib.parse import quote

# Fixed values of the algorithm, do not change.
DATE = "11111111"
SERVICE = "ses"
MESSAGE = "SendRawEmail"
TERMINAL = "aws4_request"
VERSION = 0x04


def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def smtp_password(secret_access_key: str, region: str) -> str:
    signature = _sign(("AWS4" + secret_access_key).encode("utf-8"), DATE)
    for part in (region, SERVICE, TERMINAL, MESSAGE):
        signature = _sign(signature, part)
    return base64.b64encode(bytes([VERSION]) + signature).decode("utf-8")


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("usage: ses-smtp-url.py <region>   (access key id and secret on stdin)")
    region = sys.argv[1]
    parts = sys.stdin.read().split()
    if len(parts) != 2:
        sys.exit("expected '<access key id> <secret access key>' on stdin")
    key_id, secret = parts
    password = smtp_password(secret, region)
    # Port 465 = TLS from the first byte (nodemailer: smtps). The password has + / = characters.
    print(f"smtps://{quote(key_id, safe='')}:{quote(password, safe='')}@email-smtp.{region}.amazonaws.com:465")


if __name__ == "__main__":
    main()
