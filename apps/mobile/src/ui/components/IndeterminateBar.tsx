import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

/// Thin sweeping activity bar — cursor paging has no total, so this is deliberately indeterminate.
export function IndeterminateBar() {
  const x = useRef(new Animated.Value(-1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1200, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [x]);

  return (
    <View style={styles.track}>
      <Animated.View
        style={[styles.fill, {
          transform: [{ translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-160, 360] }) }],
        }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 3, borderRadius: 2, backgroundColor: '#e4e6f2', overflow: 'hidden' },
  fill: { width: 160, height: 3, borderRadius: 2, backgroundColor: '#4457c2' },
});
