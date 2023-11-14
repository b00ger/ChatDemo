import React, { useState } from 'react';
import { Widget, addResponseMessage, addUserMessage, toggleMsgLoader } from 'react-chat-widget';
import 'react-chat-widget/lib/styles.css';
import './chat.css';
import MicIcon from './icons/mic';
import TextMode from './icons/text';

const ChatSideBar = (opts: { title: string }) => {
  const [chatEnabled, setChatEnabled] = useState(false);
  const [speechToTextMode, setSpeechToTextMode] = useState(false);
  const [searchInputField, setSearchInputField] = useState('');
  const onChatInputChange = event => {
    console.log(event);
    // setChatInputValue(value);
  };
  const customLauncher = handleToggle => {
    if (chatEnabled) {
      return;
    }
    setChatEnabled(true);
    handleToggle();
  };
  const handleSearchInputChange = e => {
    setSearchInputField(e.target.value);
  };
  const handleSpeechToTextMessage = newMessage => {
    console.log(`New message incoming! ${newMessage}`);
    addUserMessage(newMessage);
    toggleMsgLoader();
    setTimeout(() => {
      addResponseMessage('do something with ' + newMessage);
      toggleMsgLoader();
    }, 5000);
  };
  const handleNewUserMessage = newMessage => {
    console.log(`New message incoming! ${newMessage}`);
    addUserMessage(newMessage);
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
        handleTextInputChange={onChatInputChange}
        launcher={customLauncher}
      />
      <div className="sendPanel">
        <button
          disabled={speechToTextMode}
          className="arbitrary micButton"
          onClick={() => {
            setSpeechToTextMode(true);
            //You'd call this with the output of speech to text later, not here
            handleSpeechToTextMessage(
              'this is a message from outside text, use this same method for voice'
            );
          }}
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
