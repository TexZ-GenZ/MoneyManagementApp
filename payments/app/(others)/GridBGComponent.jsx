import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';

// Get screen width and height
const { width, height } = Dimensions.get('window');

const GRID_SIZE = 40; // size of grid cells in pixels
const LINE_WIDTH = 1; // thickness of grid lines

const GridBackground = () => {
  // Calculate number of horizontal and vertical lines needed
  const verticalLines = Math.ceil(width / GRID_SIZE);
  const horizontalLines = Math.ceil(height / GRID_SIZE);

  return (
    <View style={styles.container}>
      {/* Vertical grid lines */}
      {Array.from(Array(verticalLines)).map((_, index) => (
        <View
          key={`v-line-${index}`}
          style={[
            styles.gridLine,
            styles.verticalLine,
            { left: index * GRID_SIZE },
          ]}
        />
      ))}

      {/* Horizontal grid lines */}
      {Array.from(Array(horizontalLines)).map((_, index) => (
        <View
          key={`h-line-${index}`}
          style={[
            styles.gridLine,
            styles.horizontalLine,
            { top: index * GRID_SIZE },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
  },
  verticalLine: {
    width: LINE_WIDTH,
    height: '100%',
  },
  horizontalLine: {
    height: LINE_WIDTH,
    width: '100%',
  },
});

export default GridBackground;
