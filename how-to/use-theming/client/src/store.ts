import {
	Storefront,
	App,
	StorefrontLandingPage,
	StorefrontNavigationSection,
	StorefrontFooter,
	StorefrontProvider,
	StorefrontTemplate
} from "@openfin/workspace";
import { getCurrentSync } from "@openfin/workspace-platform";
import { getApps, themeBuilderApp, notificationStudio, processManager, developerContent } from "./apps";

const providerId = "use-theming";

export async function register() {
	console.log("Initialising the storefront provider.");
	const provider = await getStoreProvider();
	try {
		await Storefront.register(provider);
		console.log("Storefront provider initialised.");
	} catch (err) {
		console.error("An error was encountered while trying to register the content store provider", err);
	}
}

export async function deregister() {
	return Storefront.deregister(providerId);
}

export async function show() {
	console.log("Showing the store.");
	return Storefront.show();
}

export async function hide() {
	console.log("Hiding the store.");
	return Storefront.hide();
}

async function getStoreProvider(): Promise<StorefrontProvider> {
	console.log("Getting the store provider.");

	const webRoot = window.location.href.replace("platform/provider.html", "");

	return {
		id: providerId,
		title: "Theming Platform",
		icon: `${webRoot}favicon.ico`,
		getNavigation,
		getLandingPage,
		getFooter,
		getApps,
		launchApp: async (app: App) => {
			const platform = getCurrentSync();
			await platform.launchApp({ app });
		}
	};
}

async function getNavigation(): Promise<[StorefrontNavigationSection?, StorefrontNavigationSection?]> {
	console.log("Showing the store navigation.");

	const navigationSections: [StorefrontNavigationSection?, StorefrontNavigationSection?] = [
		{
			id: "apps",
			title: "Apps",
			items: [
				{
					id: "view",
					title: "Views",
					templateId: StorefrontTemplate.AppGrid,
					templateData: {
						apps: [themeBuilderApp]
					}
				},
				{
					id: "page",
					title: "Pages",
					templateId: StorefrontTemplate.AppGrid,
					templateData: {
						apps: [developerContent]
					}
				},
				{
					id: "manifest",
					title: "Web Apps",
					templateId: StorefrontTemplate.AppGrid,
					templateData: {
						apps: [notificationStudio, processManager]
					}
				}
			]
		}
	];

	return navigationSections;
}

async function getLandingPage(): Promise<StorefrontLandingPage> {
	console.log("Getting the store landing page.");

	const webRoot = window.location.href.replace("platform/provider.html", "");

	const landingPage: StorefrontLandingPage = {
		hero: {
			title: "Custom Hero Title",
			description: "This is a demonstration of the hero section that you can configure for your store.",
			cta: {
				id: "hero-1",
				title: "Hero Apps!",
				templateId: StorefrontTemplate.AppGrid,
				templateData: {
					apps: [notificationStudio, processManager]
				}
			},
			image: {
				src: `${webRoot}common/images/superhero-unsplash.jpg`
			}
		},
		topRow: {
			title: "Custom Top Row Content",
			items: [
				{
					id: "top-row-item-1",
					title: "Expero",
					description:
						"A collection of example views from Expero showing the power of interop and context sharing.",
					image: {
						src: `${webRoot}common/images/coding-1-unsplash.jpg`
					},
					templateId: StorefrontTemplate.AppGrid,
					templateData: {
						apps: [themeBuilderApp]
					}
				},
				{
					id: "top-row-item-2",
					title: "Dev Tools",
					description:
						"A collection of developer tools that can aid with building and debugging OpenFin applications.",
					image: {
						src: `${webRoot}common/images/coding-2-unsplash.jpg`
					},
					templateId: StorefrontTemplate.AppGrid,
					templateData: {
						apps: [notificationStudio, processManager]
					}
				}
			]
		},
		middleRow: {
			title: "A collection of simple views that show how to share context using the Interop API.",
			apps: [themeBuilderApp]
		},
		bottomRow: {
			title: "Quick Access",
			items: [
				{
					id: "bottom-row-item-1",
					title: "Views",
					description: "A collection of views made available through our catalog.",
					image: {
						src: `${webRoot}common/images/coding-4-unsplash.jpg`
					},
					templateId: StorefrontTemplate.AppGrid,
					templateData: {
						apps: [themeBuilderApp]
					}
				},
				{
					id: "bottom-row-item-2",
					title: "Web Apps",
					description: "A collection of web apps built using OpenFin.",
					image: {
						src: `${webRoot}common/images/coding-5-unsplash.jpg`
					},
					templateId: StorefrontTemplate.AppGrid,
					templateData: {
						apps: [notificationStudio, processManager]
					}
				}
			]
		}
	};

	return landingPage;
}

async function getFooter(): Promise<StorefrontFooter> {
	const webRoot = window.location.href.replace("platform/provider.html", "");

	console.log("Getting the store footer.");
	return {
		logo: { src: `${webRoot}favicon.ico`, size: "32" },
		text: "Welcome to the OpenFin Sample Footer",
		links: [
			{
				title: "Github",
				url: "https://github.com/built-on-openfin/workspace-starter"
			},
			{
				title: "YouTube",
				url: "https://www.youtube.com/user/OpenFinTech"
			}
		]
	};
}
