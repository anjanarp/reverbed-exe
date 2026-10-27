# Turns off billing for the project once the budget is used up.
# Triggered by the budget's Pub/Sub notifications. Disabling billing stops
# all paid services (the site goes offline) until billing is re-linked by hand.
import base64
import json
import os

import functions_framework
from google.cloud import billing_v1

PROJECT_ID = os.environ["GOOGLE_CLOUD_PROJECT_TO_CAP"]


@functions_framework.cloud_event
def stop_billing(cloud_event):
    payload = json.loads(base64.b64decode(cloud_event.data["message"]["data"]))

    cost = payload.get("costAmount", 0)
    budget = payload.get("budgetAmount", 0)

    if cost < budget:
        print(f"cost {cost} is under budget {budget}; nothing to do")
        return

    client = billing_v1.CloudBillingClient()
    name = f"projects/{PROJECT_ID}"

    if not client.get_project_billing_info(name=name).billing_enabled:
        print("billing already disabled")
        return

    # an empty billing account name unlinks the project from billing
    client.update_project_billing_info(
        name=name,
        project_billing_info=billing_v1.ProjectBillingInfo(billing_account_name=""),
    )
    print(f"cost {cost} reached budget {budget}; billing disabled for {PROJECT_ID}")
