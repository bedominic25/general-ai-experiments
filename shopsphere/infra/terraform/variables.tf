variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "environment" {
  type    = string
  default = "staging"
}

variable "app_name" {
  type    = string
  default = "shopsphere"
}

variable "vpc_cidr" {
  type    = string
  default = "10.42.0.0/16"
}

variable "az_count" {
  type    = number
  default = 2
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_name" {
  type    = string
  default = "shopsphere"
}

variable "db_username" {
  type    = string
  default = "shopsphere"
}

variable "api_image_tag" {
  description = "Docker image tag pushed to the ECR repo (see ecr.tf) by CI on merge to main."
  type        = string
  default     = "latest"
}

variable "api_container_port" {
  type    = number
  default = 4000
}

variable "api_desired_count" {
  type    = number
  default = 2
}

variable "api_cpu" {
  type    = number
  default = 512
}

variable "api_memory" {
  type    = number
  default = 1024
}

variable "domain_name" {
  description = "Optional custom domain for CloudFront/ALB. Leave blank to use the generated AWS hostnames."
  type        = string
  default     = ""
}
