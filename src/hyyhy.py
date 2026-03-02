import asyncio

import openfga_sdk
from openfga_sdk.client import OpenFgaClient
from openfga_sdk.client.models import ClientCheckRequest
from openfga_sdk.credentials import Credentials, CredentialConfiguration

async def main():
    credentials = Credentials(
        method="client_credentials",
        configuration=CredentialConfiguration(
            api_issuer="auth.fga.dev",
            api_audience="https://api.au1.fga.dev/",
            client_id="GRPcUCaEZtEMhhOenFPd2H0KVvpYMv2L",
            client_secret="-U6ymKRyLPPhHwg_6_za_2lpwpgDt0_nF8l9ZzSv422jOHRJ-hcJuCVDYcwglzuz",
        )
    )

    configuration = openfga_sdk.ClientConfiguration(
        api_url="https://api.au1.fga.dev",
        store_id="01KJJTRFN97PPVED7VXGWR24KM",
        credentials=credentials,
    )

    async with OpenFgaClient(configuration) as fga_client:
        options = {"authorization_model_id": "01KJKCA59Z1HE27EEVP391MF9Q"}
        body = ClientCheckRequest(
            user="user:james",
            relation="member",
            object="group:002",
        )

        response = await fga_client.check(body, options)
        print(response.allowed)

if __name__ == "__main__":
    asyncio.run(main())