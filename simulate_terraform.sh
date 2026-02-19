#!/bin/bash

echo "Simulating Terraform init and apply..."
terraform init
terraform plan
terraform apply
