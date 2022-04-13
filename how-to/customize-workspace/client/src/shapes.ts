import { StorefrontFooter, Image, CLIDispatchedSearchResult, CLISearchListenerResponse, CLIFilter, HomeSearchResponse, HomeSearchResult } from "@openfin/workspace";
import { BrowserWindowModule, CustomThemes, Page, ToolbarButton } from "@openfin/workspace-platform";
import { NotificationsPlatform } from "@openfin/workspace/notifications"; 
import { View } from "openfin-adapter";

interface PlatformProvider {
    rootUrl: string,
    enableNativeWindowIntegration: boolean
}

interface NotificationProvider extends NotificationsPlatform {};

interface ToolbarButtonDefinition {
    id: string,
    include: boolean,
    button: ToolbarButton
}
interface BrowserProvider {
    toolbarButtons?: ToolbarButtonDefinition[]
    windowOptions: {
        title?:string,
        icon?:string,
        newTabUrl?: string;
        newPageUrl?: string;
    }
}
interface HomeProvider {
    id: string,
    title: string,
    icon: string,
    hidden?: boolean,
    queryMinLength?: number,
    queryAgainst?: string[],
}

interface ThemeProvider {
    themes: CustomThemes
}

interface AppProvider {
    appsSourceUrl: string,
    includeCredentialOnSourceRequest?: "omit" | "same-origin" | "include",
    cacheDurationInMinutes?: number,
    appAssetTag?: string
}

export interface StorefrontSettingsNavigationItem {
    /**
    * This should be an idempotent and unique ID (think GUID) that doesn't change for this navigation item regardless of how
    * many times it is regenerated (e.g. e.g. more items can be added or the title changed but the ID stays the same). 
    * As you navigate around the store this ID is used as a route. So if a user clicks on a link, navigates to a new page and the re-requested navigation item has 
    * a different ID then the store will not be able to find a match and it won't be able to render the navigation item.
    */
    id: string,
    title:string,
    /**
    * The Storefront API has a collection of apps for a navigation item. Tags is an example of how you can determine what apps should be included in a navigation item.
    * i.e we filter the apps list by one or more tags and assign those apps to the navigation item. 
    */
    tags:string[]
}


interface StorefrontSettingsDetailedNavigationItem extends StorefrontSettingsNavigationItem {
    description: string, 
    image: Image
}

export interface StorefrontSettingsLandingPageRow {
    title: string,
    items: StorefrontSettingsDetailedNavigationItem[]
}
interface StorefrontProvider {
    id: string,
    title: string,
    icon: string,
    landingPage: {
        hero?: {
          title: string,
          description: string,
          cta: StorefrontSettingsNavigationItem,
          image: Image
        },
        topRow: StorefrontSettingsLandingPageRow,
        middleRow: {
            title: string,
            tags: string[]
        },
        bottomRow: StorefrontSettingsLandingPageRow
    },
    navigation:  {
         /**
        * This should be an idempotent and unique ID (think GUID) that doesn't change for this navigation section regardless of how
        * many times it is regenerated (e.g. e.g. more items can be added or the title changed but the ID stays the same). 
        * As you navigate around the store this ID is used as a route. So if a user clicks on a link, navigates to a new page and the re-requested navigation section has 
        * a different ID then the store will not be able to find a match and it won't be able to render the navigation items.
        */
        id: string,
        title: string, 
        items: StorefrontSettingsNavigationItem[] 
    }[],
    footer: StorefrontFooter
}

export interface IntegrationManager {
    platformProvider: PlatformProvider;

    launchView(view:OpenFin.PlatformViewCreationOptions | string , targetIdentity?: OpenFin.Identity): Promise<View>;
    launchPage(page:Page, bounds?: OpenFin.Bounds): Promise<BrowserWindowModule>;
}

export interface IntegrationProvider {
    integrations?: Integration<unknown>[];
}

export interface Integration<T> {
    id: string;
    title: string;
    icon: string;
    enabled: boolean;
    moduleUrl?: string;
    data?: T;
}

export interface IntegrationModule<T> {
    register?(integrationManager: IntegrationManager, integration: Integration<T>): Promise<void>;
    deregister?(integration: Integration<T>): Promise<void>;
    getSearchResults?(integration: Integration<T>, query: string, filters?: CLIFilter[]): Promise<HomeSearchResponse>;
    getAppSearchEntries?(integration: Integration<T>): Promise<HomeSearchResult[]>;
    itemSelection?(integration: Integration<T>, result: CLIDispatchedSearchResult, lastResponse?: CLISearchListenerResponse): Promise<boolean>;
}

export interface CustomSettings {
    bootstrap?: {  store: boolean, home:boolean, notifications:boolean }
    appProvider?: AppProvider,
    platformProvider?:PlatformProvider,
    browserProvider?: BrowserProvider,
    themeProvider?: ThemeProvider,
    homeProvider?: HomeProvider,
    storefrontProvider?:StorefrontProvider,
    notificationProvider?:NotificationProvider
    integrationProvider?:IntegrationProvider
}
