output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.web.domain_name
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}

output "db_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}

output "web_bucket_name" {
  value = aws_s3_bucket.web.bucket
}
