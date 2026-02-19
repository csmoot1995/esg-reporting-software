provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "compliance" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"

  tags = {
    Name = "Compliance-Instance"
  }
}

resource "aws_instance" "alerts" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"

  tags = {
    Name = "Alerts-Instance"
  }
}

resource "aws_instance" "simulator" {
  ami           = "ami-12345678"
  instance_type = "t2.micro"

  tags = {
    Name = "Simulator-Instance"
  }
}

output "compliance_instance_id" {
  value = aws_instance.compliance.id
}

output "alerts_instance_id" {
  value = aws_instance.alerts.id
}

output "simulator_instance_id" {
  value = aws_instance.simulator.id
}

resource "kubernetes_secret" "esg_secrets" {
  metadata {
    name = "esg-secrets"
  }
  data = {
    ADMIN_KEY   = var.admin_api_key
    AUDITOR_KEY = var.auditor_api_key
  }
  type = "Opaque"
}
