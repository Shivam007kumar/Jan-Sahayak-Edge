import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Provider as PaperProvider, DefaultTheme } from 'react-native-paper';
import { Ionicons } from '@expo/vector-icons';

import OnboardingScreen from './screens/OnboardingScreen';
import FeedScreen from './screens/FeedScreen';
import AgentScreen from './screens/AgentScreen';
import VaultScreen from './screens/VaultScreen';
import AutoFillScreen from './screens/AutoFillScreen';

// UX4G Indian Government Theme
const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: '#138808',       // India Green
    accent: '#FF9933',        // India Saffron
    background: '#F8FAFC',    // Light grey background
    surface: '#FFFFFF',
    text: '#1F2937',
    placeholder: '#9CA3AF',
  },
};

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Feed') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Vault') {
            iconName = focused ? 'shield-checkmark' : 'shield-checkmark-outline';
          } else if (route.name === 'Agent') {
            iconName = focused ? 'mic' : 'mic-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#138808',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: '#138808',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{ title: 'Schemes' }}
      />
      <Tab.Screen
        name="Vault"
        component={VaultScreen}
        options={{ title: 'My Vault' }}
      />
      <Tab.Screen
        name="Agent"
        component={AgentScreen}
        options={{ title: 'Jan-Sahayak AI' }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <PaperProvider theme={theme}>
      <NavigationContainer>
        <StatusBar style="dark" />
        <Stack.Navigator initialRouteName="Onboarding" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="MainTabs" component={MainTabs} />
          <Stack.Screen
            name="AutoFillScreen"
            component={AutoFillScreen}
            options={{
              headerShown: true,
              title: "Gov Web Portal",
              headerStyle: { backgroundColor: '#138808' },
              headerTintColor: '#FFFFFF',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </PaperProvider>
  );
}
