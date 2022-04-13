import {
  connect,
  ConnectionError,
  enableLogging,
  SalesforceConnection,
  SalesforceRestApiSearchResponse,
  SalesforceRestApiSObject,
} from "@openfin/salesforce";
import {
  Action,
  CLIDispatchedSearchResult,
  CLIFilter,
  CLIFilterOptionType,
  CLISearchListenerResponse,
  CLISearchResultContact,
  CLISearchResultList,
  CLISearchResultPlain,
  CLISearchResultSimpleText,
  CLITemplate,
  HomeSearchResponse,
  HomeSearchResult,
} from "@openfin/workspace";
import type { Integration, IntegrationManager } from "../shapes";

const BROWSE_SEARCH_RESULT_KEY = "browse-salesforce";
const OBJECTS_FILTER_ID = "salesforce-objects";
const NOT_CONNECTED_SEARCH_RESULT_KEY = "salesforce-not-connected-result";

let salesForceConnection: SalesforceConnection;

const PROVIDER_ID = "salesforce";

type SalesforceBatchRequest = {
  batchRequests: SalesforceBatchRequestItem[];
  haltOnError: boolean;
};

type SalesforceBatchRequestItem = {
  method: string;
  url: string;
};

type SalesforceBatchResponse = {
  hasErrors: boolean;
  results: SalesforceBatchResponseItem[];
};

type SalesforceBatchResponseItem = {
  statusCode: number;
  result: unknown;
};

type SalesforceAccount = SalesforceRestApiSObject<{
  Industry?: string;
  Name: string;
  Phone?: string;
  Type?: string;
  Website?: string;
}>;

type SalesforceContact = SalesforceRestApiSObject<{
  Department?: string;
  Email: string;
  Name: string;
  Phone?: string;
  Title?: string;
}>;

type SalesforceTask = SalesforceRestApiSObject<{
  Subject?: string;
  Description?: string;
}>;

type SalesforceContentNote = SalesforceRestApiSObject<{
  Title?: string;
  TextPreview?: string;
}>;

type SalesforceActor = {
  id: string;
  url: string;
  type: string;
  companyName: string;
  displayName: string;
  name: string;
};

type SalesforceTextArea = {
  isRichText: boolean;
  text: string;
};

type SalesforceFeedItem = {
  id: string;
  url: string;
  type: string;
  actor?: SalesforceActor;
  body?: SalesforceTextArea;
  header?: SalesforceTextArea;
};

type SalesforceFeedElementPage = {
  currentPageToken: string;
  currentPageUrl: string;
  elements: SalesforceFeedItem[];
  isModifiedToken: string;
  isModifiedUrl: string;
  nextPageUrl: string;
  updatesToken: string;
  updatesUrl: string;
};

interface SalesforceResultData {
  providerId: string;
  pageUrl: string;
}

interface SalesforceSettings {
  consumerKey: string;
  isSandbox: boolean;
  orgUrl: string;
  iconMap: {
    [id: string]: string;
  };
}

let integrationManager: IntegrationManager;

export async function register(integrationMan: IntegrationManager, integration: Integration<SalesforceSettings>): Promise<void> {
  integrationManager = integrationMan;
  console.log("Registering SalesForce");
  try {
    await openConnection(integration);
  } catch (err) {
    console.error("Error connecting to SalesForce", err);
  }
}

export async function deregister(integration: Integration<SalesforceSettings>): Promise<void> {
  await closeConnection();
}

async function openConnection(integration: Integration<SalesforceSettings>): Promise<void> {
  if (integration?.data?.orgUrl && !salesForceConnection) {
    enableLogging();
    salesForceConnection = await connect(
      integration?.data.orgUrl,
      integration?.data.consumerKey,
      integration?.data.isSandbox
    );
  }
}

async function closeConnection(): Promise<void> {
  if (salesForceConnection) {
    try {
      await salesForceConnection.disconnect();
    } catch (err) {
      console.error("Error disconnecting SalesForce", err);
    } finally {
      salesForceConnection = undefined;
    }
  }
}

const getObjectUrl = (
  objectId: string,
  salesforceOrgOrigin: string
): string => {
  return `${salesforceOrgOrigin}/${objectId}`;
};

async function getApiSearchResults(
  query: string,
  selectedObjects?: string[]
): Promise<
  (
    | SalesforceContact
    | SalesforceAccount
    | SalesforceTask
    | SalesforceContentNote
    | SalesforceFeedItem
  )[]
> {
  const accountFieldSpec = "Account(Id, Industry, Name, Phone, Type, Website)";
  const contactFieldSpec = "Contact(Department, Email, Id, Name, Phone, Title)";
  const taskFieldSpec = "Task(Id, Subject, Description)";
  const contentNoteFieldSpec = "ContentNote(Id, Title, Content, TextPreview)";
  const fieldSpecMap = new Map<string, string>([
    ["Account", accountFieldSpec],
    ["Contact", contactFieldSpec],
    ["Task", taskFieldSpec],
    ["ContentNote", contentNoteFieldSpec],
  ]);
  let fieldSpec = [...fieldSpecMap]
    .filter((x) => {
      if (selectedObjects?.length > 0) {
        return selectedObjects.includes(x[0]);
      }
      return true;
    })
    .map((x) => x[1])
    .join(", ");

  const batch: SalesforceBatchRequestItem[] = [];

  if (fieldSpec.length > 0) {
    const salesforceSearchQuery = `FIND {${escapeQuery(
      query
    )}} IN ALL FIELDS RETURNING ${fieldSpec} LIMIT 25`;

    batch.push({
      method: "GET",
      url: `/services/data/vXX.X/search?q=${encodeURIComponent(
        salesforceSearchQuery
      )}`,
    });
  }

  const includeChatter =
    !selectedObjects?.length || selectedObjects.includes("Chatter");
  if (includeChatter) {
    batch.push({
      method: "GET",
      url: `/services/data/vXX.X/chatter/feed-elements?q=${query}&pageSize=25&sort=LastModifiedDateDesc`,
    });
  }

  const batchedResults = await getBatchedResults<
    | SalesforceRestApiSearchResponse<
      | SalesforceAccount
      | SalesforceContact
      | SalesforceTask
      | SalesforceContentNote
    >
    | SalesforceFeedElementPage
  >(batch);

  let results: (
    | SalesforceAccount
    | SalesforceContact
    | SalesforceTask
    | SalesforceContentNote
    | SalesforceFeedItem
  )[] = [];

  if (batchedResults.length > 0) {
    let idx = 0;
    if (fieldSpec.length > 0) {
      const searchResponse = batchedResults[
        idx++
      ] as SalesforceRestApiSearchResponse<
        | SalesforceAccount
        | SalesforceContact
        | SalesforceTask
        | SalesforceContentNote
      >;
      if (searchResponse.searchRecords) {
        results = results.concat(searchResponse.searchRecords);
      }
    }

    if (includeChatter) {
      const chatterResponse = batchedResults[
        idx++
      ] as SalesforceFeedElementPage;
      if (chatterResponse.elements) {
        results = results.concat(chatterResponse.elements);
      }
    }
  }

  return results;
}

async function getBatchedResults<T>(
  batchRequests: SalesforceBatchRequestItem[]
): Promise<T[]> {
  if (batchRequests.length === 0) {
    return [];
  }
  const batch: SalesforceBatchRequest = { batchRequests, haltOnError: false };

  const response = await salesForceConnection.executeApiRequest<SalesforceBatchResponse>(
    `/services/data/vXX.X/composite/batch/`,
    "POST",
    batch,
    { "Content-Type": "application/json" }
  );

  return response.data?.results.map((r) => r.result as T) ?? [];
}

function escapeQuery(query: string): string {
  // There are some reserved characters for queries so we need to escape them
  // https://developer.salesforce.com/docs/atlas.en-us.soql_sosl.meta/soql_sosl/sforce_api_calls_sosl_find.htm#i1423105
  return query.replace(/[?&|!()^~*:"'+{}\-[\]\\]/gm, "\\$&");
}

export async function getAppSearchEntries(integration: Integration<SalesforceSettings>): Promise<HomeSearchResult[]> {
  const results = [];
  if (integration?.data?.orgUrl) {
    results.push({
      actions: [{ name: "Browse", hotkey: "enter" }],
      data: {
        providerId: PROVIDER_ID,
        pageUrl: integration?.data?.orgUrl,
        tags: [PROVIDER_ID]
      } as SalesforceResultData,
      icon: integration.icon,
      key: BROWSE_SEARCH_RESULT_KEY,
      template: CLITemplate.Plain,
      templateContent: undefined,
      title: "Browse Salesforce",
    } as CLISearchResultPlain);

    if (!salesForceConnection) {
      results.push(getReconnectSearchResult(integration));
    }
  }

  return results;
}

export async function itemSelection(
  integration: Integration<SalesforceSettings>,
  result: CLIDispatchedSearchResult,
  lastResponse?: CLISearchListenerResponse
): Promise<boolean> {
  // if the user clicked the reconnect result, reconnect to salesforce and re-run query
  if (result.key === NOT_CONNECTED_SEARCH_RESULT_KEY) {
    await openConnection(integration)

    if (result.data?.query) {
      let results = await getSearchResults(
        integration,
        result.data?.query,
        result.data?.filters
      );
      if (lastResponse) {
        lastResponse.revoke(NOT_CONNECTED_SEARCH_RESULT_KEY);
        lastResponse.respond(results.results);
      }
    }
    return true;
  }

  // otherwise open the result page url in browser
  const data = result.data as SalesforceResultData;
  if (data !== undefined) {
    const preload = integrationManager.platformProvider.rootUrl + "/views/salesforce/preload.js";
    const viewOptions = {
      url: data.pageUrl,
      fdc3InteropApi: "1.2",
      interop: {
        currentContextGroup: "green",
      },
      customData: { buttonLabel: "Process Participant" },
      preloadScripts: [{ url: preload }],
      target: undefined,
    };
    await integrationManager.launchView(viewOptions);
    return true;
  }
  return false;
}

export async function getSearchResults(
  integration: Integration<SalesforceSettings>,
  query: string,
  filters?: CLIFilter[]
): Promise<HomeSearchResponse> {

  if (salesForceConnection) {
    let searchResults: (
      | SalesforceAccount
      | SalesforceContact
      | SalesforceTask
      | SalesforceContentNote
      | SalesforceFeedItem
    )[];

    let selectedObjects: string[] = [];
    if (Array.isArray(filters) && filters.length > 0) {
      const objectsFilter = filters.find((x) => x.id === OBJECTS_FILTER_ID);
      if (objectsFilter) {
        selectedObjects = (
          Array.isArray(objectsFilter.options)
            ? objectsFilter.options
            : [objectsFilter.options]
        )
          .filter((x) => !!x.isSelected)
          .map((x) => (x.value === "Note" ? "ContentNote" : x.value));
      }
    }

    try {
      searchResults = await getApiSearchResults(query, selectedObjects);

      let results = searchResults.map((searchResult) => {
        if ("Website" in searchResult) {
          return {
            actions: [{ name: "View", hotkey: "enter" }],
            label: searchResult.attributes.type,
            key: searchResult.Id,
            title: searchResult.Name,
            icon: integration?.data?.iconMap.account,
            data: {
              providerId: PROVIDER_ID,
              pageUrl: getObjectUrl(searchResult.Id, integration.data?.orgUrl),
              tags: [PROVIDER_ID]
            },
            template: CLITemplate.Contact,
            templateContent: {
              name: searchResult.Name,
              title: searchResult.Industry,
              details: [
                [
                  ["Phone", searchResult.Phone],
                  ["Type", searchResult.Type],
                  ["Website", searchResult.Website],
                ],
              ],
            },
          } as CLISearchResultContact;
        } else if ("Email" in searchResult) {
          return {
            actions: [{ name: "View", hotkey: "enter" }],
            label: searchResult.attributes.type,
            key: searchResult.Id,
            title: searchResult.Name,
            icon: integration?.data?.iconMap.contact,
            data: {
              providerId: PROVIDER_ID,
              pageUrl: getObjectUrl(searchResult.Id, integration.data?.orgUrl),
              tags: [PROVIDER_ID]
            },
            template: CLITemplate.Contact,
            templateContent: {
              name: searchResult.Name,
              title: searchResult.Title,
              useInitials: true,
              details: [
                [
                  ["Department", searchResult.Department],
                  ["Email", searchResult.Email],
                  ["Work #", searchResult.Phone],
                ],
              ],
            },
          } as CLISearchResultContact;
        } else if ("Description" in searchResult) {
          return {
            actions: [{ name: "View", hotkey: "enter" }],
            label: searchResult.attributes.type,
            key: searchResult.Id,
            title: searchResult.Subject,
            icon: integration?.data?.iconMap.task,
            data: {
              providerId: PROVIDER_ID,
              pageUrl: getObjectUrl(searchResult.Id, integration.data?.orgUrl),
              tags: [PROVIDER_ID]
            },
            template: "List",
            templateContent: [
              ["Subject", searchResult.Subject],
              ["Comments", searchResult.Description],
            ],
          } as CLISearchResultList;
        } else if ("TextPreview" in searchResult) {
          return {
            actions: [{ name: "View", hotkey: "enter" }],
            label: "Note",
            key: searchResult.Id,
            title: searchResult.Title,
            icon: integration?.data?.iconMap.note,
            data: {
              providerId: PROVIDER_ID,
              pageUrl: getObjectUrl(searchResult.Id, integration.data?.orgUrl),
              tags: [PROVIDER_ID]
            },
            template: "List",
            templateContent: [
              ["Title", searchResult.Title],
              ["Content", searchResult?.TextPreview],
            ],
          } as CLISearchResultList;
        } else if (
          "actor" in searchResult &&
          (searchResult.type === "TextPost" || searchResult.type === "ContentPost")
        ) {
          return {
            actions: [{ name: "View", hotkey: "enter" }],
            label: "Chatter",
            key: searchResult.id,
            title: searchResult.actor?.displayName,
            icon: integration?.data?.iconMap.chatter,
            data: {
              providerId: PROVIDER_ID,
              pageUrl: getObjectUrl(searchResult.id, integration.data?.orgUrl),
              tags: [PROVIDER_ID]
            } as SalesforceResultData,
            template: CLITemplate.Contact,
            templateContent: {
              name: searchResult.actor?.displayName,
              useInitials: true,
              details: [
                [
                  ["Header", searchResult?.header?.text],
                  ["Note", searchResult?.body?.text],
                ],
              ],
            },
          } as CLISearchResultContact;
        } else {
          // in this case we are only searching for accounts, contacts, tasks, content notes and chatter
          return undefined;
        }
      });

      const filteredResults = results.filter(
        Boolean
      ) as CLISearchResultContact<Action>[];
      const objects = searchResults.map((result) =>
        "attributes" in result ? result.attributes.type : "Chatter"
      );

      return {
        results: filteredResults,
        context: {
          filters: getSearchFilters(
            objects.map((c) => (c === "ContentNote" ? "Note" : c))
          ),
        },
      };
    } catch (err) {
      await closeConnection();
      if (err instanceof ConnectionError) {
        return {
          results: [
            getReconnectSearchResult(integration, query, filters),
          ]
        };
      }
      console.error("Error retrieving SalesForce search results", err)
    }
  }

  return {
    results: []
  };
}

function getReconnectSearchResult(integration: Integration<SalesforceSettings>, query?: string, filters?: CLIFilter[]) {
  return {
    actions: [{ name: "Reconnect", hotkey: "enter" }],
    key: NOT_CONNECTED_SEARCH_RESULT_KEY,
    icon: integration?.icon,
    title: "Reconnect to Salesforce",
    data: {
      providerId: PROVIDER_ID,
      query,
      filters,
    },
  } as CLISearchResultSimpleText
}

function getSearchFilters(objects: string[]): CLIFilter[] {
  if (Array.isArray(objects) && objects.length > 0) {
    let filters: CLIFilter[] = [];
    let uniqueObjects = [...new Set(objects.sort())];
    let objectFilter: CLIFilter = {
      id: OBJECTS_FILTER_ID,
      title: "Objects",
      type: CLIFilterOptionType.MultiSelect,
      options: [],
    };

    uniqueObjects.forEach((object) => {
      if (Array.isArray(objectFilter.options)) {
        objectFilter.options.push({
          value: object,
          isSelected: false,
        });
      }
    });

    filters.push(objectFilter);
    return filters;
  }
  return [];
}