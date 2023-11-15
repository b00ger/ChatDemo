import React, { useState, useEffect } from 'react';
import * as Chat from './lib/index.js';
import './lib/styles.css';

import './chat.css';
import MicIcon from './icons/mic';
import TextMode from './icons/text';
const { Widget, addResponseMessage, addUserMessage, toggleMsgLoader } = Chat
const ChatSideBar = (opts: { title: string }) => {
  const [chatEnabled, setChatEnabled] = useState(false);
  const [speechToTextMode, setSpeechToTextMode] = useState(false);
  const [searchInputField, setSearchInputField] = useState('');

  const customLauncher = launchChatMethod => {
    if (chatEnabled) {
      return;
    }
    setChatEnabled(true);
    launchChatMethod();
  };
  const handleSearchInputChange = e => {
    setSearchInputField(e.target.value);
  };
  // const handleSpeechToTextMessage = newMessage => {
  //   addUserMessage(newMessage);
  //   setSearchInputField('');
  //   toggleMsgLoader();
  //   setTimeout(() => {
  //     addResponseMessage('do something with ' + newMessage);
  //     toggleMsgLoader();
  //   }, 5000);
  // };
  const handleNewUserMessage = newMessage => {
    addUserMessage(newMessage);
    setSearchInputField('');
    toggleMsgLoader();
    setTimeout(() => {
      addResponseMessage('do something with ' + newMessage);
      toggleMsgLoader();
    }, 5000);

    // fetch('https://webhook.site/c55adc77-59f8-4bc1-a57c-b7d7849e0834', {
    //   method: 'POST',
    //   body: newMessage,
    // })
    //   .then(response => response.json())
    //   .then(data => {
    //     addResponseMessage(JSON.stringify(data));
    //   })
    //   .catch(error => console.log(error));
    // Now send the message throught the backend API
  };
  const { title } = opts;
  return (
    <div className={'chatSidebar'}>
      <Widget
        title={title}
        subtitle={''}
        handleNewUserMessage={handleNewUserMessage}
        emojis={false}
        launcher={customLauncher}
      />
      <div className="sendPanel">
        <button
          disabled={speechToTextMode}
          className="arbitrary micButton"
          onClick={() => {}}
          // onClick={() => {
          //   setSpeechToTextMode(true);
          //   //You'd call this with the output of speech to text later, not here
          //   handleSpeechToTextMessage(
          //     'this is a message from outside text, use this same method for voice'
          //   );
          // }
          //}
        >
          <MicIcon size={'30px'} />
        </button>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleNewUserMessage(searchInputField);
          }}
        >
          <input
            className={'textEntryComponent'}
            onChange={handleSearchInputChange}
            value={searchInputField}
          />
        </form>
        <button
          className="arbitrary sendButton"
          onClick={() => {
            setSpeechToTextMode(false);
            handleNewUserMessage(searchInputField);
          }}
        >
          <TextMode size={'30px'} />
        </button>
      </div>
      <div className="disclaimer">
        This application is for demonstration purposes only. HOPPR is not developing an application
        for clinical use.
      </div>
    </div>
  );
};

export default ChatSideBar;
