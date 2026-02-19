variable "aws_region" {
  description = "The AWS region to deploy resources."
  default     = "us-east-1"
}

variable "instance_type" {
  description = "Instance type for the modules."
  default     = "t2.micro"
}
