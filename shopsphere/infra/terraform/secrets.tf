resource "random_password" "db" {
  length  = 24
  special = false
}

resource "random_password" "jwt_secret" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.app_name}/${var.environment}/db-credentials"
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db.result
  })
}

resource "aws_secretsmanager_secret" "jwt_secret" {
  name = "${var.app_name}/${var.environment}/jwt-secret"
}

resource "aws_secretsmanager_secret_version" "jwt_secret" {
  secret_id     = aws_secretsmanager_secret.jwt_secret.id
  secret_string = random_password.jwt_secret.result
}

# Value is intentionally left empty here - populate it out-of-band (console,
# `aws secretsmanager put-secret-value`, or your CD pipeline's own secret
# store) rather than committing a real Anthropic key to Terraform state.
resource "aws_secretsmanager_secret" "anthropic_api_key" {
  name = "${var.app_name}/${var.environment}/anthropic-api-key"
}
