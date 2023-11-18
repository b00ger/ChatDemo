import React, { useState, useEffect, useRef } from 'react';
import OpenAI, { toFile } from 'openai';
import {trio} from 'ldrs';
trio.register()

import './devmode.css';

import {
  REACT_APP_OPENAI_KEY,
  REACT_APP_HOPPR_REPORTS_URL,
  REACT_APP_HOPPR_CONFIG,
} from '../Chat/env.js';

const DevModePanel = (opts: { instance: any; studyId: string }) => {
  const { instance, studyId } = opts;

  const openai = new OpenAI({ apiKey: REACT_APP_OPENAI_KEY, dangerouslyAllowBrowser: true });
  const [searchInputField, setSearchInputField] = useState('')
  const [codeResponse, setCodeResponse] = useState(null);
  const [config, setConfig] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const assistant = useRef(null)
  const thread = useRef(null)

  // Init
  useEffect(() => {
    const loadConfig = async () => {
      console.log('Loading config')
      const response = await fetch(REACT_APP_HOPPR_CONFIG)
      setConfig(await response.json())
    }
    loadConfig();
  }, [])

  // On config loaded
  useEffect(() => {
    async function innerSetupOpenAI() {
      await setupOpenAI()
    }
    innerSetupOpenAI()
  }, [config])

  const setupOpenAI = async () => {
    console.log('Setting OpenAI');
    assistant.current = await openai.beta.assistants.retrieve('asst_lnMDPoNTOlWcNHczrjaIqiaM');
    thread.current = await openai.beta.threads.create();
    const reportResponse = await fetch(REACT_APP_HOPPR_REPORTS_URL);
    const allReports = await reportResponse.json();
    const report = allReports[studyId];
    if (report == null) {
      setCodeResponse('An error has occurred. Unable to locate study.')
      return;
    }
    await openai.beta.threads.messages.create(thread.current.id, {
      role: 'user',
      content: 'The report is: ' + report,
    });
  };

  const sendMessage = async text => {
    setCodeResponse(null)
    setIsLoading(true)
    await openai.beta.threads.messages.create(thread.current.id, {
      role: 'user',
      content: text,
    });
    const run = await openai.beta.threads.runs.create(thread.current.id, { assistant_id: assistant.current.id });
    while (true) {
      const result = await openai.beta.threads.runs.retrieve(thread.current.id, run.id);
      console.log(result.status);
      if (result.status === 'completed') {
        break;
      }
    }
    const messages = await openai.beta.threads.messages.list(thread.current.id);
    //@ts-ignore
    const response = messages.data[0].content[0].text.value.replace('```json', '').replace('```', '').trim();
    setIsLoading(false)
    setCodeResponse(response)
  };

  const handleSearchInputChange = e => {
    setSearchInputField(e.target.value);
  };

  const handleNewUserMessage = newMessage => {
    console.log('Sending ' + newMessage);
    setSearchInputField('');
    sendMessage(newMessage);
  };

  return (
    <div className='devPanel'>
      <div className='inputPanel'>
      <form
          onSubmit={e => {
            e.preventDefault();
            handleNewUserMessage(searchInputField);
          }}
        >
          <input
            className='textEntryComponent'
            disabled={config == null}
            onChange={handleSearchInputChange}
            value={searchInputField}
          />
        </form>
      </div>
      {isLoading && <div className='loadingContainer'>
        <l-trio
          size="40"
          speed="1.3"
          color="white"
        />
      </div>}
      {codeResponse && <div className='codeContainer'>
        <code>
          <pre>
            {codeResponse}
          </pre>
        </code>
      </div>}
    </div>
  )
}

export default DevModePanel;
