import { OpenAI } from "openai";
import { chatPanelAppendMessage } from './chat-panel-helpers';
import { markdownToHtml } from "./markdown-helpers";

const titleUntitled = 'Untitled';

function ThreadItem(id, created, metadata) {
  this.id = id;
  this.created = created;
  this.metadata = metadata;
}

function threadItemIsUntitled(item) {
  return item.metadata === titleUntitled;
}

async function threadItemsCheckIfUpdatesNeeded(userInput, computerResponse, currentThreadId) {
  let items = threadItemsGet();
  threadItemsCheckMoveOrAdd(items, currentThreadId);

  await threadItemsSetTitleIfUntitled(items, userInput, computerResponse);
}

function threadItemsCheckMoveOrAdd(items, currentThreadId) {
  threadItemsCheckMoveTop(items, currentThreadId);
  threadItemsCheckAddNew(items, currentThreadId);
}

function threadItemsCheckMoveTop(items, threadId) {
  let item = items.find(item => item.id === threadId);
  if (item) {
    threadItemsMoveTop(items, item);
  }
}

function threadItemsMoveTop(items, item) {
  var index = items.indexOf(item);
  if (index !== -1) {
    items.splice(index, 1);
  }
  item.created = Math.floor(Date.now() / 1000);
  items.unshift(item);
  localStorage.setItem('threadItems', JSON.stringify(items));
  threadPanelPopulate(items);
}

function threadItemsCheckAddNew(items, threadId) {
  if (items.length === 0 || items[0].id !== threadId) {
    threadItemsAddNew(items, new ThreadItem(threadId, Math.floor(Date.now() / 1000), titleUntitled));
  }
}

function threadItemsAddNew(items, newItem) {
  items.unshift(newItem);
  localStorage.setItem('threadItems', JSON.stringify(items));
  threadPanelPopulate(items);
}

function threadItemsDelete(items, id) {
  let index = items.findIndex(item => item.id === id);
  if (index !== -1) {
    items.splice(index, 1);
    localStorage.setItem('threadItems', JSON.stringify(items));
    threadPanelPopulate(items);
  }
}

function threadItemsGet() {
  const threadItemsString = localStorage.getItem('threadItems');
  if (threadItemsString) {
    return JSON.parse(threadItemsString);
  } else {
    return [];
  }
}

function threadItemsGetGroupName(timestamp) {
  const now = new Date();
  const itemDate = new Date(timestamp * 1000);
  const isToday = itemDate.toDateString() === now.toDateString();
  const isYesterday = itemDate.toDateString() === new Date(new Date().setDate(now.getDate() - 1)).toDateString();
  const isThisWeek = itemDate > new Date(new Date().setDate(now.getDate() - 7));
  const isThisYear = itemDate.getFullYear() === now.getFullYear();

  return isToday ? 'Today'
    : isYesterday ? 'Yesterday'
      : isThisWeek ? "Previous 7 days"
        : isThisYear ? itemDate.toLocaleDateString('en-US', { month: 'long' }) // month name
          : itemDate.toLocaleDateString('en-US', { year: 'numeric' }); // the year
}

function threadItemsGroupByDate(threadItems) {
  const groupedItems = new Map();

  threadItems.forEach(item => {
    const group = threadItemsGetGroupName(item.created);
    if (!groupedItems.has(group)) {
      groupedItems.set(group, []);
    }
    groupedItems.get(group).push(item);
  });

  return groupedItems;
}

async function threadItemsSetTitleIfUntitled(items, userInput, computerResponse) {
  if (threadItemIsUntitled(items[0])) {
    await threadItemsSetTitle(userInput, computerResponse, items, 0);
    threadIdInAddressSet(items[0].id, items[0].metadata);
  }
}

async function threadItemsSetTitle(userInput, computerResponse, items, i) {

  // What's the system prompt?
  const AZURE_OPENAI_SYSTEM_PROMPT = import.meta.env.AZURE_OPENAI_SYSTEM_PROMPT ?? "You are a helpful AI assistant.";

  // NOTE: Never deploy your API Key in client-side environments like browsers or mobile apps
  // SEE: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

  // Get the required environment variables
  const AZURE_OPENAI_API_KEY = import.meta.env.AZURE_OPENAI_API_KEY ?? "<insert your Azure OpenAI API key here>";
  const AZURE_OPENAI_API_VERSION = import.meta.env.AZURE_OPENAI_API_VERSION ?? "<insert your Azure OpenAI API version here>";
  const AZURE_OPENAI_CHAT_DEPLOYMENT = import.meta.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? "<insert your Azure OpenAI chat deployment name here>";
  const AZURE_OPENAI_ENDPOINT = import.meta.env.AZURE_OPENAI_ENDPOINT ?? "<insert your Azure OpenAI endpoint here>";
  const AZURE_OPENAI_BASE_URL = `${AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')}/openai/deployments/${AZURE_OPENAI_CHAT_DEPLOYMENT}`;

  // Check if the required environment variables are set
  const azureOk = 
    AZURE_OPENAI_API_KEY != null && !AZURE_OPENAI_API_KEY.startsWith('<insert') &&
    AZURE_OPENAI_API_VERSION != null && !AZURE_OPENAI_API_VERSION.startsWith('<insert') &&
    AZURE_OPENAI_CHAT_DEPLOYMENT != null && !AZURE_OPENAI_CHAT_DEPLOYMENT.startsWith('<insert') &&
    AZURE_OPENAI_ENDPOINT != null && !AZURE_OPENAI_ENDPOINT.startsWith('<insert');

  const ok = azureOk &&
    AZURE_OPENAI_SYSTEM_PROMPT != null && !AZURE_OPENAI_SYSTEM_PROMPT.startsWith('<insert');

  if (!ok) {
    chatPanelAppendMessage('computer', markdownToHtml(
      'To use Azure OpenAI, set the following environment variables:\n' +
      '\n  AZURE_OPENAI_SYSTEM_PROMPT' +
      '\n  AZURE_OPENAI_API_KEY' +
      '\n  AZURE_OPENAI_API_VERSION' +
      '\n  AZURE_OPENAI_CHAT_DEPLOYMENT' +
      '\n  AZURE_OPENAI_ENDPOINT'
    ));
    chatPanelAppendMessage('computer', markdownToHtml(
      '\nYou can easily do that using the Azure AI CLI by doing one of the following:\n' +
      '\n  ai init' +
      '\n  ai dev new .env' +
      '\n  npm run webpack' +
      '\n' +
      '\n  or' +
      '\n' +
      '\n  ai init' +
      '\n  ai dev shell' +
      '\n  npm run webpack' +
      '\n' +
      '\n  or' +
      '\n' +
      '\n  ai init' +
      '\n  ai dev shell --run "npm run webpack"'
    ));
    throw new Error('Missing required environment variables');
  }

  // Create the OpenAI client
  console.log('Using Azure OpenAI (w/ API Key)...');
  const openai = new OpenAI({
    apiKey: AZURE_OPENAI_API_KEY,
    baseURL: AZURE_OPENAI_BASE_URL,
    defaultQuery: { 'api-version': AZURE_OPENAI_API_VERSION },
    defaultHeaders: { 'api-key': AZURE_OPENAI_API_KEY },
    dangerouslyAllowBrowser: true
  });

  // Prepare the messages for the OpenAI API
  let messages = [
    { role: 'system', content: AZURE_OPENAI_SYSTEM_PROMPT },
    { role: 'user', content: userInput },
    { role: 'assistant', content: computerResponse },
    { role: 'system', content: "Please suggest a title for this interaction. Don't be cute or humorous in your answer. Answer only with a factual descriptive title. Do not use quotes. Do not prefix with 'Title:' or anything else. Just emit the title." }
  ];

  // Call the OpenAI API to get a title for the conversation
  const completion = await openai.chat.completions.create({
    messages: messages,
    model: AZURE_OPENAI_CHAT_DEPLOYMENT
  });

  var newTitle = completion.choices[i].message.content;
  items[i].metadata = newTitle;

  localStorage.setItem('threadItems', JSON.stringify(items));
  threadPanelPopulate(items);

  return newTitle;
}

function threadPanelPopulate(items) {

  // Clear existing content
  const threadPanel = document.getElementById('threadPanel');
  threadPanel.innerHTML = '';

  // Group thread items by date
  const groupedThreadItems = threadItemsGroupByDate(items);

  // Iterate over grouped items and populate thread panel
  for (const [date, items] of groupedThreadItems) {
    const dateHeader = document.createElement('div');
    dateHeader.classList.add('threadOnDate');
    dateHeader.textContent = date;
    threadPanel.appendChild(dateHeader);

    const threadsContainer = document.createElement('div');
    threadsContainer.id = 'threads';
    threadPanel.appendChild(threadsContainer);

    items.forEach(item => {
      const button = document.createElement('button');
      button.id = item.id;
      button.classList.add('thread', 'w3-button');
      button.onclick = function() {
        loadThread(item.id);
        threadIdInAddressSet(item.id, item.metadata);
      };

      const div = document.createElement('div');
      div.classList.add('thread-title');

      const icon = document.createElement('i');
      icon.classList.add('threadIcon', 'fa', 'fa-comment');

      const trashIcon = document.createElement('i');
      trashIcon.classList.add('trash-icon', 'fa', 'fa-trash');
      trashIcon.onclick = function(event) {
        event.stopPropagation();
        threadItemsDelete(threadItemsGet(), item.id);
      };

      div.appendChild(icon);
      div.appendChild(document.createTextNode(item.metadata));
      button.appendChild(div);
      button.appendChild(trashIcon);
      threadsContainer.appendChild(button);
    });
  }
}

function threadIdInAddressClear() {
  window.location.hash = '';
  document.title = 'New Chat';
}

function threadIdInAddressSet(id, newTitle) {
  window.location.hash = id;
  document.title = newTitle;
}

export { threadItemsCheckIfUpdatesNeeded, threadItemsDelete, threadItemsGet, threadItemsGetGroupName, threadItemsGroupByDate, threadItemsSetTitle, threadPanelPopulate, threadIdInAddressClear, threadIdInAddressSet };