import { Dock, DockButtonNames, DockProvider } from "@openfin/workspace";

const providerId = "register-with-dock-basic";

export async function register(options: {
	showHome: boolean;
	showNotifications: boolean;
	showStorefront: boolean;
	showWorkspaces: boolean;
	customIconUrl: string;
	customOpenUrl: string;
}) {
	console.log("Initialising the dock provider.");
	const provider = await getDockProvider(options);
	try {
		await Dock.register(provider);
		console.log("Dock provider initialised.");
	} catch (err) {
		console.error("An error was encountered while trying to register the content dock provider", err);
	}
}

export async function deregister() {
	return Dock.deregister();
}

export async function show() {
	console.log("Showing the dock.");
	return Dock.show();
}

export async function minimize() {
	console.log("Minimizing the dock.");
	return Dock.minimize();
}

async function getDockProvider(options: {
	showHome: boolean;
	showNotifications: boolean;
	showStorefront: boolean;
	showWorkspaces: boolean;
	customIconUrl: string;
	customOpenUrl: string;
}): Promise<DockProvider> {
	console.log("Getting the dock provider.");

	const webRoot = window.location.href.replace("platform/provider.html", "");

	return {
		id: providerId,
		title: "Basic Dock",
		icon: `${webRoot}favicon.ico`,
		workspaceComponents: {
			hideHomeButton: !options.showHome,
			hideNotificationsButton: !options.showNotifications,
			hideStorefrontButton: !options.showStorefront,
			hideWorkspacesButton: !options.showWorkspaces
		},
		buttons: [
			{
				tooltip: "Google",
				iconUrl: "https://www.google.com/favicon.ico",
				action: {
					id: "launch-google"
				}
			},
			{
				tooltip: "Bing",
				iconUrl: "https://www.bing.com/favicon.ico",
				action: {
					id: "launch-bing"
				}
			},
			{
				tooltip: "Custom",
				iconUrl: options.customIconUrl,
				action: {
					id: "launch-custom",
					customData: options.customOpenUrl
				}
			},
			{
				type: DockButtonNames.DropdownButton,
				tooltip: "Social",
				iconUrl: `${webRoot}assets/spanner.svg`,
				options: [
					{
						tooltip: "Twitter",
						action: {
							id: "launch-tools",
							customData: "twitter"
						}
					},
					{
						tooltip: "Facebook",
						action: {
							id: "launch-tools",
							customData: "facebook"
						}
					}
				]
			}
		]
	};
}
