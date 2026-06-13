import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {
  createMaterialTopTabNavigator,
  MaterialTopTabBarProps,
} from '@react-navigation/material-top-tabs';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
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

const Tab = createMaterialTopTabNavigator<TabParamList>();

const ICONS: Record<string, string> = {
  Chat: '💬',
  Improve: '✨',
  Social: '📣',
  Settings: '⚙️',
};

/**
 * Custom bottom tab bar rendered by the swipeable (material-top-tabs) navigator.
 * Keeps the familiar bottom-navigation look (icon + label) while the navigator
 * provides left/right swipe between tabs.
 */
function BottomTabBar({state, navigation}: MaterialTopTabBarProps) {
  const t = useTheme();
  const c = t.colors;
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: c.surface,
          borderTopColor: c.outline,
          paddingBottom: insets.bottom,
        },
      ]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const color = focused ? c.primary : c.onSurfaceVariant;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            android_ripple={{color: c.surfaceVariant, borderless: true}}
            style={styles.item}>
            {focused && (
              <View style={[styles.indicator, {backgroundColor: c.primary}]} />
            )}
            <Text style={{fontSize: 18, color}}>{ICONS[route.name]}</Text>
            <Text style={[styles.label, {color, fontFamily: fonts.medium}]}>
              {route.name}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Swipeable bottom tabs: swipe left/right to move between
 * Chat → Improve → Social → Settings (tapping still works).
 */
export const createBottomTabs = () => () => (
  <Tab.Navigator
    tabBarPosition="bottom"
    initialRouteName="Chat"
    tabBar={props => <BottomTabBar {...props} />}
    screenOptions={{swipeEnabled: true}}>
    <Tab.Screen name="Chat" component={ChatScreen} />
    <Tab.Screen name="Improve" component={ImproveScreen} />
    <Tab.Screen name="Social" component={SocialScreen} />
    <Tab.Screen name="Settings" component={SettingsScreen} />
  </Tab.Navigator>
);

const styles = StyleSheet.create({
  bar: {flexDirection: 'row', borderTopWidth: 1},
  item: {flex: 1, alignItems: 'center', paddingTop: 8, paddingBottom: 6, gap: 2},
  indicator: {
    position: 'absolute',
    top: 0,
    width: 32,
    height: 3,
    borderRadius: 3,
  },
  label: {fontSize: 11},
});
