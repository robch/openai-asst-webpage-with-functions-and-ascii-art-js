import { OpenAI } from "openai";
import { factory } from './OpenAIAssistantsCustomFunctions';
import { OpenAIAssistantsFunctionsStreamingClass } from './OpenAIAssistantsFunctionsStreamingClass';

import { markdownInit, markdownToHtml } from "./markdown-helpers";
import { populateNewChartsNow } from './markdown-chart-helpers';
import { populateNewSvgsNow, populateNewAsciiArtFromSvgNow } from './markdown-svg-helpers';

import { chatPanelAppendMessage, chatPanelIsScrollAtBottom, chatPanelScrollToBottom, chatPanelClear } from './chat-panel-helpers';
import { logoShow } from './logo-helpers';
import { themeInit, toggleTheme } from './theme-helpers';
import { threadItemsCheckIfUpdatesNeeded, threadItemsGet, threadPanelPopulate, threadIdInAddressClear } from './thread-item-helpers';

let assistant;
async function assistantInit(threadId = null) {

  // Which assistant, which thread?
  const ASSISTANT_ID = import.meta.env.ASSISTANT_ID ?? "<insert your OpenAI assistant ID here>";

  // NOTE: Never deploy your API Key in client-side environments like browsers or mobile apps
  // SEE: https://help.openai.com/en/articles/5112595-best-practices-for-api-key-safety

  // Get the required environment variables
  const AZURE_OPENAI_API_KEY = import.meta.env.AZURE_OPENAI_API_KEY ?? "<insert your Azure OpenAI API key here>";
  const AZURE_OPENAI_API_VERSION = import.meta.env.AZURE_OPENAI_API_VERSION ?? "<insert your Azure OpenAI API version here>";
  const AZURE_OPENAI_ENDPOINT = import.meta.env.AZURE_OPENAI_ENDPOINT ?? "<insert your Azure OpenAI endpoint here>";
  const AZURE_OPENAI_BASE_URL = `${AZURE_OPENAI_ENDPOINT.replace(/\/+$/, '')}/openai`;

  // Check if the required environment variables are set
  const azureOk = 
    AZURE_OPENAI_API_KEY != null && !AZURE_OPENAI_API_KEY.startsWith('<insert') &&
    AZURE_OPENAI_API_VERSION != null && !AZURE_OPENAI_API_VERSION.startsWith('<insert') &&
    AZURE_OPENAI_ENDPOINT != null && !AZURE_OPENAI_ENDPOINT.startsWith('<insert');

  const ok = azureOk &&
    ASSISTANT_ID != null && !ASSISTANT_ID.startsWith('<insert');

  if (!ok) {
    chatPanelAppendMessage('computer', markdownToHtml(
      'To use Azure OpenAI, set the following environment variables:\n' +
      '\n  ASSISTANT_ID' +
      '\n  AZURE_OPENAI_API_KEY' +
      '\n  AZURE_OPENAI_API_VERSION' +
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

  // Create the assistants streaming helper class instance
  assistant = new OpenAIAssistantsFunctionsStreamingClass(ASSISTANT_ID, factory, openai)

  await assistantCreateOrRetrieveThread(threadId);
}

async function assistantProcessInput(userInput) {
  const blackVerticalRectangle = '\u25AE'; // Black vertical rectangle ('▮') to simulate an insertion point

  let newMessage = chatPanelAppendMessage('computer', blackVerticalRectangle);
  let completeResponse = "";

  await assistant.getResponse(userInput, function (response) {
    let atBottomBeforeUpdate = chatPanelIsScrollAtBottom();

    completeResponse += response;
    let withEnding = `${completeResponse}${blackVerticalRectangle}`;
    let asHtml = markdownToHtml(withEnding);

    if (asHtml !== undefined) {
      newMessage.innerHTML = asHtml;

      // Populate charts and SVGs now:
      populateNewChartsNow();
      populateNewSvgsNow();

      if (atBottomBeforeUpdate) {
        chatPanelScrollToBottom();
      }
    }
  });

  newMessage.innerHTML = markdownToHtml(completeResponse) || completeResponse.replace(/\n/g, '<br/>');
  populateNewChartsNow();
  populateNewSvgsNow();
  populateNewAsciiArtFromSvgNow();

  chatPanel.scrollTop = chatPanel.scrollHeight;

  await threadItemsCheckIfUpdatesNeeded(userInput, completeResponse, assistant.thread.id);
  userInputTextAreaFocus();
}

async function assistantCreateOrRetrieveThread(threadId = null) {

  const threadIdOk = threadId != null && threadId.length > 5;
  if (!threadIdOk) {
    await assistant.createThread()
  } else {
    await assistant.retrieveThread(threadId);
    await assistant.getThreadMessages((role, content) => {
      let html = markdownToHtml(content) || content.replace(/\n/g, '<br/>');
      role = role === 'user' ? 'user' : 'computer';
      chatPanelAppendMessage(role, html);
    });
    populateNewChartsNow();
    populateNewSvgsNow();
    populateNewAsciiArtFromSvgNow();
  }
}

function userInputTextAreaGetElement() {
  return document.getElementById("userInput");
}

function userInputTextAreaInit() {
  let inputElement = userInputTextAreaGetElement();
  inputElement.addEventListener("keydown", userInputTextAreaHandleKeyDown());
  inputElement.addEventListener("input", userInputTextAreaUpdateHeight);
}

function userInputTextAreaFocus() {
  let inputElement = userInputTextAreaGetElement();
  inputElement.focus();
}

function userInputTextAreaClear() {
  userInputTextAreaGetElement().value = '';
  userInputTextAreaUpdateHeight();
}

function userInputTextAreaUpdateHeight() {
  let inputElement = userInputTextAreaGetElement();
  inputElement.style.height = 'auto';
  inputElement.style.height = (userInput.scrollHeight) + 'px';
}

function userInputTextAreaHandleKeyDown() {
  return function (event) {
    if (event.key === "Enter") {
      if (!event.shiftKey) {
        event.preventDefault();
        sendMessage();
      }
    }
  };
}

function varsInit() {
  document.addEventListener('DOMContentLoaded', varsUpdateHeightsAndWidths);
  window.addEventListener('resize', varsUpdateHeightsAndWidths);
}

function varsUpdateHeightsAndWidths() {
  let headerHeight = document.querySelector('#header').offsetHeight;
  let userInputHeight = document.querySelector('#userInputPanel').offsetHeight;
  document.documentElement.style.setProperty('--header-height', headerHeight + 'px');
  document.documentElement.style.setProperty('--input-height', userInputHeight + 'px');
}

async function newChat() {
  threadIdInAddressClear();
  hideLeftSide();
  chatPanelClear();
  logoShow();
  userInputTextAreaFocus();
  await assistantCreateOrRetrieveThread();
}

async function loadThread(threadId) {
  chatPanelClear();
  await assistantCreateOrRetrieveThread(threadId);
  userInputTextAreaFocus();
}

function sendMessage() {
  let inputElement = userInputTextAreaGetElement();
  let inputValue = inputElement.value;

  let notEmpty = inputValue.trim() !== '';
  if (notEmpty) {
    let html = markdownToHtml(inputValue) || inputValue.replace(/\n/g, '<br/>');
    chatPanelAppendMessage('user', html);
    userInputTextAreaClear();
    varsUpdateHeightsAndWidths();
    assistantProcessInput(inputValue);
  }
}

function hideLeftSide() {
  const leftSide = document.getElementById('leftSide');
  leftSide.classList.remove('show');
  const closeButton = document.getElementById('closeButton');
  const hamburgerButton = document.getElementById('hamburgerButton');
  closeButton.style.display = 'none';
  hamburgerButton.style.display = 'block';
}

function toggleLeftSide() {
  const leftSide = document.getElementById('leftSide');
  leftSide.classList.toggle('show');
  const closeButton = document.getElementById('closeButton');
  const hamburgerButton = document.getElementById('hamburgerButton');
  if (leftSide.classList.contains('show')) {
    closeButton.style.display = 'block';
    hamburgerButton.style.display = 'none';
  } else {
    closeButton.style.display = 'none';
    hamburgerButton.style.display = 'block';
  }
}

async function init() {

  const urlParams = new URLSearchParams(window.location.search);

  themeInit();
  markdownInit();
  userInputTextAreaInit();
  varsInit();

  const threadIdFromAnchor = window.location.hash.substring(1);
  const threadId = urlParams.get('thread') || threadIdFromAnchor;

  let items;
  await assistantInit(threadId);

  const clear = urlParams.get('clear') === 'true';
  if (clear) {
    localStorage.removeItem('threadItems');
    items = [];
  }

  items = items || threadItemsGet();
  threadPanelPopulate(items);

  userInputTextAreaFocus();

  window.newChat = newChat;
  window.loadThread = loadThread;
  window.sendMessage = sendMessage;
  window.toggleTheme = toggleTheme;
  window.toggleLeftSide = toggleLeftSide;
  window.hideLeftSide = hideLeftSide;
}

init();
