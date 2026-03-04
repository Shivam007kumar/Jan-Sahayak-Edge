import React, { useState, useRef } from 'react';
import {
    View,
    StyleSheet,
    ScrollView,
    KeyboardAvoidingView,
    Platform,
    TextInput,
    TouchableOpacity,
    ActivityIndicator,
    Linking,
} from 'react-native';
import { useHeaderHeight } from '@react-navigation/elements';
import { Text } from 'react-native-paper';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

const VAULT_KEY = '@jan_sahayak_vault';

// Change this to your FastAPI backend URL
const API_BASE = Platform.OS === 'android' ? 'http://10.0.2.2:8000' : 'http://localhost:8000';
const API_URL = `${API_BASE}/api/chat`;
const API_HISTORY = `${API_BASE}/api/history`;

export default function ChatScreen() {
    const headerHeight = useHeaderHeight();
    const [messages, setMessages] = useState([
        {
            id: '0',
            role: 'assistant',
            text: 'Namaste! 🙏 Main Jan-Sahayak hoon. Mujhse poochiye ki aap kis sarkari yojana ke liye eligible hain!',
        },
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const scrollRef = useRef(null);

    React.useEffect(() => {
        const loadHistory = async () => {
            try {
                let sessionId = await AsyncStorage.getItem('guestSessionId');
                if (!sessionId) {
                    sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                    await AsyncStorage.setItem('guestSessionId', sessionId);
                }
                const response = await axios.get(API_HISTORY, {
                    headers: { 'X-Session-Id': sessionId }
                });
                if (response.data && response.data.messages && response.data.messages.length > 0) {
                    const loadedMessages = response.data.messages.map((m, idx) => ({
                        id: `hist_${idx}`,
                        role: m.role,
                        text: m.content
                    }));
                    setMessages(loadedMessages);
                    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 300);
                }
            } catch (e) {
                console.log("No history found or failed to load", e);
            }
        };
        loadHistory();
    }, []);

    const getVaultDocs = async () => {
        try {
            const stored = await AsyncStorage.getItem(VAULT_KEY);
            if (stored) {
                const vault = JSON.parse(stored);
                // Return only the keys where value is true
                return Object.entries(vault)
                    .filter(([_, val]) => val)
                    .map(([key]) => key);
            }
        } catch (e) {
            console.error('Failed to read vault:', e);
        }
        return [];
    };

    const sendMessage = async () => {
        if (!input.trim() || loading) return;

        const userText = input.trim();
        const userMsg = { id: Date.now().toString(), role: 'user', text: userText };

        setMessages((prev) => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        // Scroll to bottom
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);

        try {
            // Read vault docs from AsyncStorage
            const vaultDocs = await getVaultDocs();
            const savedLang = await AsyncStorage.getItem('appLanguage');
            const language = savedLang || 'hi-IN';

            let sessionId = await AsyncStorage.getItem('guestSessionId');
            if (!sessionId) {
                sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                await AsyncStorage.setItem('guestSessionId', sessionId);
            }

            const response = await axios.post(API_URL, {
                query: userText,
                vault_docs: vaultDocs,
                language: language,
            }, {
                headers: { 'X-Session-Id': sessionId }
            });

            const data = response.data;

            // Build assistant message
            let replyText = data.reply;

            // Append missing docs info if available
            if (data.missing_docs && data.missing_docs.length > 0) {
                const missing = data.missing_docs
                    .map((d) => d.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()))
                    .join(', ');
                replyText += `\n\n📋 Missing: ${missing}`;
            }

            // Append action if available
            if (data.action) {
                replyText += `\n\n👉 ${data.action}`;
            }

            const assistantMsg = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: replyText,
                scheme_url: data.scheme_url || null,
            };

            setMessages((prev) => [...prev, assistantMsg]);
        } catch (error) {
            console.error('API Error:', error);
            const errorMsg = {
                id: (Date.now() + 1).toString(),
                role: 'assistant',
                text: 'Maaf kijiye, server se baat nahi ho paa rahi. Kya aapka backend chal raha hai?',
            };
            setMessages((prev) => [...prev, errorMsg]);
        } finally {
            setLoading(false);
            setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 200);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={headerHeight}
        >
            {/* Messages */}
            <ScrollView
                ref={scrollRef}
                style={styles.messageList}
                contentContainerStyle={styles.messageListContent}
            >
                {messages.map((msg) => (
                    <View
                        key={msg.id}
                        style={[
                            styles.messageBubble,
                            msg.role === 'user' ? styles.userBubble : styles.assistantBubble,
                        ]}
                    >
                        {msg.role === 'assistant' && (
                            <Text style={styles.botName}>🤖 Jan-Sahayak</Text>
                        )}
                        <Text
                            style={[
                                styles.messageText,
                                msg.role === 'user' ? styles.userText : styles.assistantText,
                            ]}
                        >
                            {msg.text}
                        </Text>

                        {msg.scheme_url && (
                            <TouchableOpacity
                                style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0FDF4', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#16A34A' }}
                                onPress={() => Linking.openURL(msg.scheme_url)}
                            >
                                <Ionicons name="globe-outline" size={16} color="#16A34A" />
                                <Text style={{ color: '#16A34A', fontWeight: 'bold', marginLeft: 6, fontSize: 13 }}>🌍 Open Portal</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                ))}

                {/* Typing indicator */}
                {loading && (
                    <View style={[styles.messageBubble, styles.assistantBubble]}>
                        <Text style={styles.botName}>🤖 Jan-Sahayak</Text>
                        <View style={styles.typingRow}>
                            <ActivityIndicator size="small" color="#138808" />
                            <Text style={styles.typingText}>soch raha hoon...</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Input bar */}
            <View style={styles.inputBar}>
                <TextInput
                    style={styles.textInput}
                    value={input}
                    onChangeText={setInput}
                    placeholder="Apna sawaal poochiye..."
                    placeholderTextColor="#9CA3AF"
                    onSubmitEditing={sendMessage}
                    returnKeyType="send"
                    editable={!loading}
                />
                <TouchableOpacity
                    style={[styles.sendButton, loading && styles.sendButtonDisabled]}
                    onPress={sendMessage}
                    disabled={loading}
                >
                    <Ionicons name="send" size={22} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    messageList: {
        flex: 1,
    },
    messageListContent: {
        padding: 16,
        paddingBottom: 8,
    },
    messageBubble: {
        maxWidth: '85%',
        padding: 12,
        borderRadius: 16,
        marginBottom: 10,
    },
    userBubble: {
        alignSelf: 'flex-end',
        backgroundColor: '#138808',
        borderBottomRightRadius: 4,
    },
    assistantBubble: {
        alignSelf: 'flex-start',
        backgroundColor: '#FFFFFF',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    botName: {
        fontSize: 11,
        fontWeight: '700',
        color: '#138808',
        marginBottom: 4,
    },
    messageText: {
        fontSize: 15,
        lineHeight: 22,
    },
    userText: {
        color: '#FFFFFF',
    },
    assistantText: {
        color: '#1F2937',
    },
    typingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    typingText: {
        fontSize: 13,
        color: '#6B7280',
        marginLeft: 8,
        fontStyle: 'italic',
    },
    inputBar: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    textInput: {
        flex: 1,
        backgroundColor: '#F3F4F6',
        borderRadius: 24,
        paddingHorizontal: 16,
        paddingVertical: 10,
        fontSize: 15,
        color: '#1F2937',
        marginRight: 8,
    },
    sendButton: {
        backgroundColor: '#138808',
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sendButtonDisabled: {
        opacity: 0.5,
    },
});
