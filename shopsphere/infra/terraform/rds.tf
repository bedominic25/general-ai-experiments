resource "aws_db_subnet_group" "main" {
  name       = "${var.app_name}-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

# RDS-managed Postgres with the pgvector extension (supported natively on RDS
# Postgres 15.2+). This is the production counterpart of the `postgres`
# service in docker-compose.yml - after this applies, run
# apps/api/prisma/pgvector-extension.sql once against it (see infra/README.md)
# to add the ANN index src/ai/vectorStore.ts's PgVectorStore queries.
resource "aws_db_instance" "main" {
  identifier     = "${var.app_name}-${var.environment}"
  engine         = "postgres"
  engine_version = "15.7"
  instance_class = var.db_instance_class

  allocated_storage     = 20
  max_allocated_storage = 100
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.db.id]

  backup_retention_period = 7
  skip_final_snapshot     = var.environment != "production"
  deletion_protection     = var.environment == "production"

  tags = { Name = "${var.app_name}-${var.environment}-db" }
}
