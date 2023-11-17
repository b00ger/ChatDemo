import React, { useState, useEffect, useRef } from 'react';
import * as Chat from './lib/index.js';
import OpenAI, { toFile } from 'openai';
import './lib/styles.css';
import { v4 as uuidv4 } from 'uuid';

import './chat.css';
import MicIcon from './icons/mic';
import TextMode from './icons/text';
import {
  REACT_APP_ALTHEA_URL,
  REACT_APP_OPENAI_KEY,
  REACT_APP_HOPPR_REPORTS_URL,
  REACT_APP_HOPPR_CONFIG,
  sendTextPacket,
  setupPacket,
} from './env.js';
const {
  Widget,
  addResponseMessage,
  addUserMessage,
  toggleMsgLoader,
  deleteMessages,
  dropMessages,
} = Chat;
const ChatSideBar = (opts: { instance: any; studyId: string }) => {
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
  const { instance, studyId } = opts;

  let title = '';
  if (instance != null) {
    const {
      PatientSex,
      PatientAge,
      PatientName,
      AcquisitionDate,
      StudyInstanceUID,
    } = instance;
    title += 'Patient: ' + PatientName;
    if (PatientAge) {
      title += ' | Age: ' + PatientAge;
    }
    if (PatientSex) {
      title += ' | Sex: ' + PatientSex
    }
    if (AcquisitionDate) {
      let date = new Date(
        AcquisitionDate.slice(0, 4),
        Number(AcquisitionDate.slice(4, 6)) - 1,
        AcquisitionDate.slice(6, 8)
      )
      title +=
        ' | Date: ' + (date.getMonth() + 1) + '/' + date.getDate() + '/' + date.getFullYear()
    }
  }

  /// DAN H'S DANGER ZONE

  const [mode, setMode] = useState('althea');
  const openai = new OpenAI({ apiKey: REACT_APP_OPENAI_KEY, dangerouslyAllowBrowser: true });
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const socket = useRef(null)
  const [altheaText, setAltheaText] = useState('');
  const [finalText, setFinalText] = useState('');
  const [loading, setLoading] = useState(false);
  const [altheaStreamId, setAltheaStreamId] = useState(null);
  const [sentences, setSentences] = useState([]);
  const [words, setWords] = useState([]);
  const [isSentenceComplete, setIsSentenceComplete] = useState([true, true]);
  const [messageId, setMessageId] = useState(null);
  const [config, setConfig] = useState(null)
  const [connected, setConnected] = useState(false)
  const [isDisabled, setIsDisabled] = useState(true)
  let thread = null;
  let assistant = null;

  useEffect(() => {
    const loadConfig = async () => {
      console.log('Loading config')
      const response = await fetch(REACT_APP_HOPPR_CONFIG)
      setConfig(await response.json())
    }
    loadConfig();
    dropMessages();
  }, []);

  useEffect(() => {
    if (config == null) {
      return;
    }
    console.log('Config loaded. Starting chat experience.')
    const ws = new WebSocket(REACT_APP_ALTHEA_URL);
    socket.current = ws;
    ws.onopen = async () => {
      if (mode !== 'althea') {
        return;
      }

      const reportResponse = await fetch(REACT_APP_HOPPR_REPORTS_URL);
      const allReports = await reportResponse.json();
      const report = allReports[studyId];
      if (report == null) {
        await queueResponse('I was unable to find this particular study in our database.');
        return;
      }
      let name = config['botName']
      console.log('Setting up Althea as ' + name);
      setupPacket.payload.receiveMode = 'text';
      setupPacket.payload.responseMode = 'text';
      setupPacket.payload.bot_name = name
      setupPacket.payload.report = report;
      // sending the init conditions
      ws.send(JSON.stringify(setupPacket));
      setConnected(true)
      await queueResponse(
        config['welcomeMessage'].replace('{botName}', name).replace('{modality}', instance.Modality),
        false
      )
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
  }, [config])

  // Observe sentences
  useEffect(() => {
    function playNext(sentence) {
      const text = sentence[0];
      const mp3 = sentence[1];
      if (mp3 != null) {
        console.log('Starting audible sentence ' + text);
        setIsSentenceComplete([false, false]);
        const audio = new Audio(mp3);
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
        audio.play();
      } else {
        console.log('Starting silent sentenc ' + text)
        setIsSentenceComplete([true, false]);
      }
      setWords(prev => prev.concat(text.split(' ')));
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
    await queueResponse(response);
  };

  const queueResponse = async (response, speak = true) => {
    const speech = speak ? await createSpeechMp3(response) : null;
    setSentences(prev => [...prev, [response, speech]]);
  };

  const sendMessageAlthea = text => {
    sendTextPacket.streamSid = altheaStreamId;
    sendTextPacket.payload = text;
    socket.current.send(JSON.stringify(sendTextPacket));
  };

  const handleAltheaResponse = async text => {
    //@ts-ignore
    setAltheaText(async prevText => {
      const newText = (await prevText) + text;
      const trimmed = text.trim();
      const lastChar = trimmed[trimmed.length - 1];
      if (lastChar === '.' || lastChar === '?' || lastChar === '!') {
        console.log('Adding sentence: ' + newText);
        await queueResponse(newText);
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

  useEffect(() => {
    setIsDisabled(!connected || !isSentenceComplete[0] || !isSentenceComplete[1])
  }, [connected, isSentenceComplete])

  /// END OF DAN H'S DANGER ZONE

  return (
    <div className='chatSidebar'>
      <Widget
        title={title}
        subtitle={''}
        handleNewUserMessage={handleNewUserMessage}
        emojis={false}
        launcher={customLauncher}
      />
      <div className="sendPanel">
        <button
          disabled={isDisabled}
          className="arbitrary micButton"
          onMouseDown={startRecording}
          onMouseUp={stopRecording}
          onMouseLeave={stopRecording}
        >
          <MicIcon
            size={'30px'}
            color={recording ? 'red' : 'white'}
          />
        </button>
        <form
          onSubmit={e => {
            e.preventDefault();
            handleNewUserMessage(searchInputField);
          }}
        >
          <input
            className={'textEntryComponent'}
            disabled={isDisabled}
            onChange={handleSearchInputChange}
            value={searchInputField}
          />
        </form>
        <button
          className="arbitrary sendButton"
          disabled={isDisabled}
          onClick={() => {
            setSpeechToTextMode(false);
            handleNewUserMessage(searchInputField);
          }}
        >
          <TextMode size={'30px'} />
        </button>
      </div>
      {config && <div className="disclaimer" dangerouslySetInnerHTML={{__html: config['disclaimerText']}} />}
    </div>
  );
};

export default ChatSideBar;
