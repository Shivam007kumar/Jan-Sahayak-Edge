import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, Animated, Platform, ActivityIndicator
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Audio } from 'expo-av';
import axios from 'axios';
import { TextInput } from 'react-native';

const API_URL = Platform.OS === 'android' ? 'http://10.0.2.2:8000/api/chat' : 'http://localhost:8000/api/chat';

export default function AgentScreen({ navigation }) {
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [transcript, setTranscript] = useState('');

    // Animation Values
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const soundRef = useRef(null);

    useEffect(() => {
        // Start pulse animation loop
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.2, duration: 1500, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true })
            ])
        ).start();

        return () => {
            if (soundRef.current) {
                soundRef.current.unloadAsync();
            }
        };
    }, []);

    const addLog = (msg) => {
        setLogs(prev => {
            const newLogs = [...prev, msg];
            if (newLogs.length > 4) newLogs.shift();
            return newLogs;
        });
    };

    const handleOrbPress = () => {
        if (isProcessing) return;

        if (transcript.trim() === '') {
            // User just cliked Orb without text, simulate demo query for hackathon flow
            const demoText = "Bhai PM kisan me apply karna hai mere paas Aadhar hai.";
            setTranscript(demoText);
        } else {
            processQuery(transcript);
        }
    };

    const handleOrbRelease = () => {
        if (transcript.trim() !== '') {
            processQuery(transcript);
        }
    };

    const getVaultDocs = async () => {
        try {
            const stored = await AsyncStorage.getItem('jan_sahayak_vault');
            const keys = [];
            if (stored) {
                const vault = JSON.parse(stored);
                Object.entries(vault).forEach(([k, v]) => { if (v) keys.push(k); });
            }
            // Check for vision-captured docs
            const aadharData = await AsyncStorage.getItem('aadhar_data');
            if (aadharData) keys.push('aadhar_card');
            const landData = await AsyncStorage.getItem('land_data');
            if (landData) keys.push('land_record_7_12');
            return keys;
        } catch (e) {
            return [];
        }
    };

    const processQuery = async (queryText) => {
        setIsProcessing(true);
        addLog(`User: "${queryText}"`);

        // Simulated thought sequence
        setTimeout(() => addLog('🔍 Searching Knowledge Base...'), 500);
        setTimeout(() => addLog('🛡️ Accessing Vault...'), 1200);

        try {
            const vaultDocs = await getVaultDocs();
            const savedLang = await AsyncStorage.getItem('appLanguage');
            const language = savedLang || 'hi-IN';

            // Generate or retrieve persistent guest session ID
            let sessionId = await AsyncStorage.getItem('guestSessionId');
            if (!sessionId) {
                sessionId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
                await AsyncStorage.setItem('guestSessionId', sessionId);
            }

            const response = await axios.post(API_URL, {
                query: queryText,
                vault_docs: vaultDocs,
                language: language
            }, {
                headers: { 'X-Session-Id': sessionId }
            });

            const data = response.data;

            setTimeout(() => addLog('🎙️ Generating Audio...'), 2000);

            // Play AWS Polly Audio if included
            if (data.audio_base64) {
                setTimeout(async () => {
                    try {
                        const uri = `data:audio/mp3;base64,${data.audio_base64}`;
                        const { sound } = await Audio.Sound.createAsync({ uri });
                        soundRef.current = sound;
                        await sound.playAsync();
                    } catch (e) {
                        console.error("Audio playback error", e);
                    }
                }, 2200);
            }

            // Action Router Logic
            setTimeout(() => {
                setIsProcessing(false);
                addLog(`Agent: "${data.reply}"`);

                if (data.action === "OPEN_CAMERA") {
                    navigation.navigate('CameraScreen', { docType: data.doc_type || 'aadhar' });
                } else if (data.action === "AUTO_FILL") {
                    navigation.navigate('AutoFillScreen');
                }
                setTranscript(''); // Clear on complete
            }, 2500);

        } catch (error) {
            console.error('Chat API Error:', error);
            setIsProcessing(false);
            addLog('❌ Agent offline. Check connection.');
        }
    };

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Jan-Sahayak Core</Text>
                <Text style={styles.subtitle}>Voice-First Digital Sovereign AI</Text>
            </View>

            {/* Thought Process Terminal Box */}
            <View style={styles.terminalBox}>
                <View style={styles.terminalHeader}>
                    <View style={styles.dotRed} />
                    <View style={styles.dotYellow} />
                    <View style={styles.dotGreen} />
                    <Text style={styles.terminalTitle}>System Core Logs</Text>
                </View>
                <View style={styles.terminalBody}>
                    {logs.length === 0 && !isListening && (
                        <Text style={styles.terminalTextDim}>Awaiting input payload...</Text>
                    )}
                    {logs.map((log, index) => (
                        <Text key={index} style={styles.terminalText}>
                            {log}
                        </Text>
                    ))}
                    {transcript !== '' && isListening && (
                        <Text style={styles.terminalTextActive}> {transcript}█</Text>
                    )}
                </View>
            </View>

            {/* Premium Input Bar */}
            <View style={styles.inputContainer}>
                <TextInput
                    style={styles.input}
                    placeholder="Type your query..."
                    placeholderTextColor="#475569"
                    value={transcript}
                    onChangeText={setTranscript}
                    editable={!isProcessing}
                    onSubmitEditing={() => processQuery(transcript)}
                />
            </View>

            {/* Main Glowing Orb interaction */}
            <View style={styles.orbContainer}>
                {transcript.length > 0 && (
                    <Animated.View style={[styles.glowRing, { transform: [{ scale: pulseAnim }] }]} />
                )}

                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={handleOrbPress}
                    disabled={isProcessing}
                    style={[styles.orb, transcript.length > 0 && styles.orbActive, isProcessing && styles.orbProcessing]}
                >
                    {isProcessing ? (
                        <ActivityIndicator size="large" color="#FFFFFF" />
                    ) : (
                        <Ionicons name="mic" size={48} color={transcript.length > 0 ? "#FFFFFF" : "rgba(255,255,255,0.7)"} />
                    )}
                </TouchableOpacity>

                <Text style={styles.orbHint}>
                    {isProcessing ? "Processing intelligence..." : "Tap Orb to Execute"}
                </Text>
            </View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0F172A', // Premium dark
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        paddingBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    subtitle: {
        fontSize: 14,
        color: '#94A3B8',
        marginTop: 4,
        fontWeight: '500',
    },
    terminalBox: {
        marginHorizontal: 24,
        backgroundColor: '#1E293B',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        overflow: 'hidden',
        height: 180,
    },
    terminalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0F172A',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#334155',
    },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444', marginRight: 6 },
    dotYellow: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#F59E0B', marginRight: 6 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981', marginRight: 12 },
    terminalTitle: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    terminalBody: {
        padding: 16,
        flex: 1,
        justifyContent: 'flex-end',
    },
    terminalText: {
        color: '#E2E8F0',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        marginBottom: 6,
        lineHeight: 18,
    },
    terminalTextDim: {
        color: '#475569',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        fontStyle: 'italic',
    },
    terminalTextActive: {
        color: '#34D399',
        fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
        fontSize: 13,
        marginTop: 6,
    },
    inputContainer: {
        paddingHorizontal: 24,
        marginTop: 20,
    },
    input: {
        backgroundColor: '#1E293B',
        borderRadius: 24,
        paddingHorizontal: 20,
        paddingVertical: 14,
        color: '#FFFFFF',
        fontSize: 15,
        borderWidth: 1,
        borderColor: '#334155',
    },
    orbContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingBottom: 40,
    },
    glowRing: {
        position: 'absolute',
        width: 220,
        height: 220,
        borderRadius: 110,
        backgroundColor: 'rgba(52, 211, 153, 0.15)',
    },
    orb: {
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: '#0F172A',
        borderWidth: 2,
        borderColor: '#34D399',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#34D399',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: 20,
        elevation: 10,
    },
    orbActive: {
        backgroundColor: '#34D399',
        shadowColor: '#10B981',
        shadowOpacity: 1,
        shadowRadius: 30,
    },
    orbProcessing: {
        borderColor: '#FDE047',
        shadowColor: '#FDE047',
    },
    orbHint: {
        color: '#94A3B8',
        fontSize: 14,
        marginTop: 40,
        fontWeight: '500',
    }
});
