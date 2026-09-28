# Reference IaC only - see infra/README.md. Nobody has run `terraform apply`
# against this; it documents the intended AWS topology for the local
# docker-compose stack (postgres -> RDS, api -> ECS Fargate, web -> S3+CloudFront).
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.60"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    # Fill in via `terraform init -backend-config=...` per environment;
    # left unconfigured here so this repo never accidentally points at a
    # real state bucket.
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "shopsphere"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}
