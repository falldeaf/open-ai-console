import argparse
import aiohttp
import asyncio
import pysmartthings
import os

from dotenv import load_dotenv
load_dotenv()

#token = os.getenv("SMARTTHINGS_API_KEY")
token = os.environ.get('SMARTTHINGS_API_KEY')

parser = argparse.ArgumentParser(description="A script that does something.")
parser.add_argument("--devices", help="List all devices", action="store_true")
parser.add_argument("--did", help="device id")
parser.add_argument("--capab", help="on/off a device")
parser.add_argument("--command", help="on/off a device")
parser.add_argument("--arg", help="on/off a device")
args = parser.parse_args()

async def list_devices():
	async with aiohttp.ClientSession() as session:
		api = pysmartthings.SmartThings(session, token)

		devices = await api.devices()
		for device in devices:
			if 'switch' in device.capabilities:
				colorcap = 'colorControl' in device.capabilities
				levelcap = 'switchLevel' in device.capabilities
				print(f"device({device.label} [{'color' if colorcap else ''} {'level' if levelcap else ''}] : {device.device_id}),")

async def switch_device(did, capab, comm, arg):
	async with aiohttp.ClientSession() as session:
		api = pysmartthings.SmartThings(session, token)

		devices = await api.devices()
		for device in devices:
			if device.device_id == did:
				if comm == 'setLevel':
					arg = [int(arg), 2]

				if not arg:
					result = await device.command("main", capab, comm)
					assert result == True
				else:
					result = await device.command("main", capab, comm, arg)
					assert result == True

if args.devices:
	asyncio.run(list_devices())

if args.capab:
	#print(f"switching device {args.did} to {args.switch}")
	asyncio.run(switch_device(args.did, args.capab, args.command, args.arg))
