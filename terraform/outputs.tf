output "compliance_instance_id" {
  value = aws_instance.compliance.id
}

output "alerts_instance_id" {
  value = aws_instance.alerts.id
}

output "simulator_instance_id" {
  value = aws_instance.simulator.id
}
