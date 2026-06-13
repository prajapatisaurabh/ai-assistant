import React from 'react';
import {Text} from 'react-native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {ChatScreen} from '@/screens/ChatScreen';
import {ImproveScreen} from '@/screens/ImproveScreen';
import {SocialScreen} from '@/screens/SocialScreen';
import {SettingsScreen} from '@/screens/SettingsScreen';
import {useTheme} from '@/theme/ThemeProvider';
import {fonts} from '@/theme/typography';

export type TabParamList = {
  Chat: undefined;
  Improve: undefined;
  Social: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const icon = (glyph: string) => ({color}: {color: string}) =>
  <Text style={{fontSize: 18, color}}>{glyph}</Text>;

export const createBottomTabs = () => () => {
  const t = useTheme();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.onSurfaceVariant,
        tabBarLabelStyle: {fontFamily: fonts.medium, fontSize: 11},
        tabBarStyle: {backgroundColor: t.colors.surface, borderTopColor: t.colors.outline},
      }}>
      <Tab.Screen name="Chat" component={ChatScreen} options={{tabBarIcon: icon('💬')}} />
      <Tab.Screen name="Improve" component={ImproveScreen} options={{tabBarIcon: icon('✨')}} />
      <Tab.Screen name="Social" component={SocialScreen} options={{tabBarIcon: icon('📣')}} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{tabBarIcon: icon('⚙️')}} />
    </Tab.Navigator>
  );
};
