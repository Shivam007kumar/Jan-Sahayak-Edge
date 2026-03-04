import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ScrollView, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Card } from 'react-native-paper';

const MOCK_SCHEMES = [
    { id: '1', title: 'PM Kisan Samman Nidhi', category: 'Agriculture', desc: 'Financial benefit of Rs 6000/- per year to eligible farmer families.' },
    { id: '2', title: 'Post Matric Scholarship', category: 'Students', desc: 'Full tuition fee reimbursement + maintenance allowance for SC/ST/OBC.' },
    { id: '3', title: 'Ayushman Bharat PM-JAY', category: 'Healthcare', desc: 'Health insurance cover of Rs. 5 Lakhs per family per year.' },
];

const FILTERS = ['All', 'Agriculture', 'Students', 'Healthcare'];

export default function FeedScreen({ navigation }) {
    const [activeFilter, setActiveFilter] = useState('All');
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true })
            ])
        ).start();
    }, [pulseAnim]);

    const filteredSchemes = activeFilter === 'All'
        ? MOCK_SCHEMES
        : MOCK_SCHEMES.filter(s => s.category === activeFilter);

    const renderItem = ({ item }) => (
        <Card style={styles.card} mode="elevated" elevation={2}>
            <Card.Content>
                <View style={styles.cardHeader}>
                    <Text style={styles.categoryBadge}>{item.category}</Text>
                </View>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardDesc}>{item.desc}</Text>
                <TouchableOpacity style={styles.applyButton}>
                    <Text style={styles.applyButtonText}>Check Eligibility</Text>
                    <Ionicons name="arrow-forward" size={16} color="#138808" />
                </TouchableOpacity>
            </Card.Content>
        </Card>
    );

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Gov Schemes</Text>
                <Text style={styles.headerSubtitle}>Discover benefits for you</Text>
            </View>

            {/* Filters */}
            <View style={styles.filterContainer}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    {FILTERS.map(filter => (
                        <TouchableOpacity
                            key={filter}
                            style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
                            onPress={() => setActiveFilter(filter)}
                        >
                            <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>
                                {filter}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Feed List */}
            <FlatList
                data={filteredSchemes}
                keyExtractor={item => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
            />

            {/* Massive FAB */}
            <Animated.View style={[styles.fabContainer, { transform: [{ scale: pulseAnim }] }]}>
                <TouchableOpacity
                    style={styles.fab}
                    onPress={() => navigation.navigate('Agent')}
                    activeOpacity={0.9}
                >
                    <Ionicons name="mic" size={32} color="#FFFFFF" />
                </TouchableOpacity>
            </Animated.View>

        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 15,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#6B7280',
        marginTop: 4,
    },
    filterContainer: {
        marginBottom: 10,
    },
    filterScroll: {
        paddingHorizontal: 16,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginRight: 8,
    },
    filterChipActive: {
        backgroundColor: '#E8F5E9',
        borderColor: '#138808',
    },
    filterText: {
        fontSize: 14,
        color: '#4B5563',
        fontWeight: '500',
    },
    filterTextActive: {
        color: '#138808',
        fontWeight: 'bold',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 100, // Make room for FAB
    },
    card: {
        marginBottom: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    categoryBadge: {
        fontSize: 12,
        fontWeight: 'bold',
        color: '#138808',
        backgroundColor: '#E8F5E9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
        textTransform: 'uppercase',
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
        marginBottom: 6,
    },
    cardDesc: {
        fontSize: 14,
        color: '#6B7280',
        lineHeight: 20,
        marginBottom: 16,
    },
    applyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    applyButtonText: {
        color: '#138808',
        fontWeight: '600',
        marginRight: 6,
        fontSize: 14,
    },
    fabContainer: {
        position: 'absolute',
        bottom: 24,
        right: 24,
        shadowColor: '#138808',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    },
    fab: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#1F2937', // Dark floating button
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#138808',
    },
});
