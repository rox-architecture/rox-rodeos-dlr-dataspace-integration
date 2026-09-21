/**
 * A complete rodeos:perceptionVisionSoftware instance on the container
 * operational path — valid on both axes, so route tests can start from a
 * document that passes validation and only vary what they are about.
 */
export const complete: Record<string, unknown> = {
  "dcterms:title": "Test pose estimator",
  "dcterms:type": "softwareComponent",
  "dcterms:publisher": "Test GmbH",
  "dcterms:license": "https://www.apache.org/licenses/LICENSE-2.0",
  "dcterms:identifier": "Test Pose Estimator",
  "dcterms:description": "Estimates poses.",
  "dcat:version": "1.0.0",
  "dcat:keyword": ["pose estimation", "test"],
  "dcat:contactPoint": "someone@example.org",
  "rodeos:coreType": "Component",
  "rodeos:componentType": "softwareComponent",
  "rodeos:softwareAssetType": "perceptionVisionSoftware",
  "rodeos:capabilityClass": "perception",
  "rodeos:perceptionVisionSoftwareType": "poseEstimation",
  "rodeos:aasSubmodel": "https://example.org/aas.json",
  "rodeos:operationalType": "container",
  "rodeos:distributionType": "oci_registry",
  "rodeos:imageName": "test/pose",
  "rodeos:imageTag": "1.0.0",
  "rodeos:platforms": ["linux/amd64"],
  "rodeos:hardwareRequirements": [
    { subject: "hardware.compute.gpu", operator: "required" },
  ],
}
