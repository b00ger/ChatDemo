import React, { useState, useEffect, useRef } from 'react';
import * as Chat from './lib/index.js';
import OpenAI, { toFile } from 'openai';
import './lib/styles.css';
import { v4 as uuidv4 } from 'uuid';

import './chat.css';
import MicIcon from './icons/mic';
import TextMode from './icons/text';
import { REACT_APP_ALTHEA_URL, REACT_APP_OPENAI_KEY, sendTextPacket, setupPacket } from './env.js';
const {
  Widget,
  addResponseMessage,
  addUserMessage,
  toggleMsgLoader,
  deleteMessages,
  dropMessages,
} = Chat;
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
  const handleNewUserMessage = newMessage => {
    sendMessage(newMessage);
  };
  const { title } = opts;

  /// DAN H'S DANGER ZONE

  const mode = 'althea';
  const openai = new OpenAI({ apiKey: REACT_APP_OPENAI_KEY, dangerouslyAllowBrowser: true });
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const [altheaText, setAltheaText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [loading, setLoading] = useState(false);
  const [altheaStreamId, setAltheaStreamId] = useState(null);
  const [socket, setSocket] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [words, setWords] = useState([]);
  const [isSentenceComplete, setIsSentenceComplete] = useState([true, true]);
  const [messageId, setMessageId] = useState(null);
  let thread = null;
  let assistant = null;

  useEffect(() => {
    dropMessages();
    if (socket != null) {
      return;
    }
    const ws = new WebSocket(REACT_APP_ALTHEA_URL);
    setSocket(ws);
    ws.onopen = () => {
      if (mode !== 'althea') {
        return;
      }
      console.log('Setting up Althea');
      setupPacket.payload.receiveMode = 'text';
      setupPacket.payload.responseMode = 'text';
      setupPacket.payload.report = `
        FINDINGS:
        The cardiac size is normal. The mediastinum is within normal limits. The lung fields are clear. The skeletal
        structures are unremarkable.

        IMPRESSION:
        Normal chest x-ray.
        `;
      // sending the init conditions
      ws.send(JSON.stringify(setupPacket));
    };

    // websocket onclose event listener
    ws.onclose = e => {
      console.log(e);
    };

    // websocket onerror event listener
    ws.onerror = error => {
      console.error(
        'WebSocket encountered error: ',
        //@ts-ignore
        error.message,
        'Closing socket'
      );

      ws.close();
    };
    ws.onmessage = async evt => {
      // on receiving a message from the server
      const message = JSON.parse(evt.data);
      if (message.event === 'start') {
        setAltheaStreamId(message.streamSid);
      } else if (message.event === 'media') {
        await handleAltheaResponse(message.media.payload);
      }
    };
  }, []);

  // Observe sentences
  useEffect(() => {
    function playNext(sentence) {
      setIsSentenceComplete([false, false]);
      const text = sentence[0];
      console.log('Starting sentence ' + text);
      const audio = new Audio(sentence[1]);
      audio.onended = _ => {
        console.log('Finished saying sentence ' + text);
        setIsSentenceComplete(complete => {
          if (!complete[1]) {
            return [true, false];
          }
          if (complete[0]) {
            return complete;
          }
          console.log('Popping sentence in audio');
          setSentences(s => s.slice(1));
          return [true, true];
        });
      };
      setWords(prev => prev.concat(text.split(' ')));
      audio.play();
    }
    setLoadingVisible(false);
    console.debug('There are now ' + sentences.length + ' sentences');
    if (sentences.length === 0) {
      return;
    }
    setIsSentenceComplete(complete => {
      if (complete[0] && complete[1]) {
        playNext(sentences[0]);
      }
      return complete;
    });
  }, [sentences]);

  // Observe individual words
  useEffect(() => {
    function showNext(word) {
      setFinalText(prevMsg => {
        const text = prevMsg + word + ' ';
        setMessageId(id => {
          if (id == null) {
            const newId = uuidv4().toString();
            addResponseMessage(text, newId);
            return newId;
          }
          deleteMessages(1, id);
          addResponseMessage(text, id);
          return id;
        });
        return text;
      });
      const timeout = word.endsWith(',') ? 600 : 220;
      setTimeout(() => {
        setWords(prev => prev.slice(1));
      }, timeout);
    }
    console.debug('There are now ' + words.length + ' words');
    if (words.length === 0) {
      setIsSentenceComplete(complete => {
        console.log('Finished words for sentence');
        if (!complete[0]) {
          return [false, true];
        }
        if (complete[1]) {
          return complete;
        }
        console.log('Popping sentence in words');
        setSentences(s => s.slice(1));
        return [true, true];
      });
      return;
    }
    showNext(words[0]);
  }, [words]);

  const updateRecording = async () => {
    if (recording) {
      stopRecording();
      return;
    }
    await startRecording();
  };

  const startRecording = async () => {
    setAltheaText('');
    setFinalText('');
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.addEventListener('dataavailable', handleDataAvailable);
    mediaRecorderRef.current.start();
    setRecording(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const handleDataAvailable = async ({ data }) => {
    if (data.size <= 0) {
      return;
    }
    console.log('Getting audio transcription');
    const buffer = await data.arrayBuffer();
    const transcription = await openai.audio.transcriptions.create({
      file: await toFile(buffer, 'speech.mp3'),
      model: 'whisper-1',
    });
    sendMessage(transcription.text);
  };

  const setLoadingVisible = visible => {
    setLoading(prev => {
      if (prev != visible) {
        toggleMsgLoader();
      }
      return visible;
    });
  };

  const sendMessage = async text => {
    addUserMessage(text);
    setSearchInputField('');
    setLoadingVisible(true);
    setMessageId(null);
    setFinalText('');
    //@ts-ignore
    if (mode === 'openai') {
      await sendMessageAndSayResponseOpenAI(text);
    } else {
      sendMessageAlthea(text);
    }
  };

  const sendMessageAndSayResponseOpenAI = async text => {
    if (assistant === null) {
      await setupOpenAI();
    }
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: text,
    });
    const run = await openai.beta.threads.runs.create(thread.id, { assistant_id: assistant.id });
    while (true) {
      const result = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      console.log(result.status);
      if (result.status === 'completed') {
        break;
      }
    }
    const messages = await openai.beta.threads.messages.list(thread.id);
    //@ts-ignore
    const response = messages.data[0].content[0].text.value;
    const speech = await createSpeechMp3(response);
    setSentences(prev => [...prev, [response, speech]]);
  };

  const sendMessageAlthea = text => {
    sendTextPacket.streamSid = altheaStreamId;
    sendTextPacket.payload = text;
    socket.send(JSON.stringify(sendTextPacket));
  };

  const handleAltheaResponse = async text => {
    //@ts-ignore
    setAltheaText(async prevText => {
      const newText = (await prevText) + text;
      const trimmed = text.trim();
      const lastChar = trimmed[trimmed.length - 1];
      if (lastChar === '.' || lastChar === '?' || lastChar === '!') {
        console.log('Adding sentence: ' + newText);
        const mp3 = await createSpeechMp3(newText);
        const tuple = [newText, mp3];
        setSentences(prev => [...prev, tuple]);
        return '';
      }
      return newText;
    });
  };

  const createSpeechMp3 = async text => {
    const mp3 = await openai.audio.speech.create({
      model: 'tts-1',
      voice: 'alloy',
      input: text,
    });
    const buffer = await mp3.arrayBuffer();
    return URL.createObjectURL(new Blob([buffer]));
  };

  const setupOpenAI = async () => {
    console.log('Setting up for first time');
    assistant = await openai.beta.assistants.retrieve('asst_lnMDPoNTOlWcNHczrjaIqiaM');
    thread = await openai.beta.threads.create();
  };

  /// END OF DAN H'S DANGER ZONE

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
<<<<<<< HEAD
          disabled={speechToTextMode}
          className={`arbitrary micButton ${recording ? 'recording' : ''}`}
          onClick={updateRecording}
          aria-details={'Press to start recording then press again to stop.'}
=======
          disabled={!isSentenceComplete[0] || !isSentenceComplete[0]}
          className="arbitrary micButton"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
>>>>>>> dd3ecaa81a48825eb8642c8e547177c4014a2704
        >
          <MicIcon size={'30px'} color={recording ? "red" : "white"} />
        </button>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleNewUserMessage(searchInputField);
          }}
        >
          <input
            className={'textEntryComponent'}
            disabled={!isSentenceComplete[0] || !isSentenceComplete[0] || recording}
            onChange={handleSearchInputChange}
            value={searchInputField}
          />
        </form>
        <button
          className="arbitrary sendButton"
          disabled={!isSentenceComplete[0] || !isSentenceComplete[0] || recording}
          onClick={() => {
            setSpeechToTextMode(false);
            handleNewUserMessage(searchInputField);
          }}
        >
          <TextMode size={'30px'} />
        </button>
      </div>
      <div className="disclaimer">
        This application is for research and development purposes only. <br />HOPPR
        is not developing this application for clinical use.
      </div>
    </div>
  );
};

export default ChatSideBar;
