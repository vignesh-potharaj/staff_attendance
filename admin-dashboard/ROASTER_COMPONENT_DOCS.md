# Beautiful Staff Roaster Display Component

## Overview

A modern, fully responsive staff roaster display component built with React, TypeScript, Tailwind CSS, and Framer Motion. Features glassmorphism design, smooth animations, and comprehensive responsiveness across mobile, tablet, and desktop devices.

## Features

### 🎨 Visual Design
- **Glassmorphism** aesthetic with subtle borders and backdrop blur effects
- **Apple-style** clean and minimalist design language
- **Professional color palette** with Indigo (active), Emerald (scheduled), Amber (leave), and Slate (week off)
- **Soft rounded corners** (2xl radius) throughout for a modern feel
- **Responsive shadow effects** that adapt to hover states and device size

### 📱 Responsive Breakpoints

#### Mobile (< 640px)
- **Card Stack View**: Vertical layout with optimized touch targets
- **FAB (Floating Action Button)**: Large, easy-to-tap button for creating schedules
- **Simplified Date Navigation**: Compact date picker with swipe-friendly controls
- **Stacked Statistics**: 2-column grid for metrics

#### Tablet (640px - 1024px)
- **2-Column Grid**: Cards displayed in pairs for better space utilization
- **Enhanced Date Controls**: Better spacing and readability
- **4-Column Statistics**: Full metrics display
- **Improved Spacing**: 4-6px gaps between elements

#### Desktop (> 1024px)
- **3-Column Grid**: Full display of roaster records
- **Hover Effects**: Interactive card elevation and color transitions
- **Dynamic Statistics**: Comprehensive data overview
- **Header Button**: Primary action button in navigation

### 🎯 Component Features

#### RoasterCard Component
Individual staff member schedule card with:
- **Staff Avatar**: Gradient circle with initials or icon
- **Status Badge**: Visual indicator for Leave/Week Off/Scheduled
- **Time Display**: Start and end times in readable format
- **Striped Background**: Visual distinction for week-off status
- **Responsive Typography**: Text scales appropriately for all devices

#### RoasterSkeleton Component
Loading state with:
- **Animated Placeholder Blocks**: Smooth pulse animations
- **Staggered Appearance**: Sequential fade-in for visual interest
- **Responsive Grid**: Matches final layout for smooth transition

#### RoasterDisplay Component (Main)
Complete roaster view with:
- **Date Navigation**: Arrows and "Today" button for date selection
- **Statistics Bar**: Real-time counts for Total, Scheduled, On Leave, Week Off
- **Error Handling**: User-friendly error messages with retry capability
- **Empty State**: Helpful messaging when no data available
- **Floating Action Button**: Mobile-optimized schedule creation

## Component Structure

```tsx
RoasterDisplay (Main Component)
├── Date Navigation Controls
├── Statistics Bar (4 cards)
├── Error State (conditional)
├── Loading State (RoasterSkeleton - conditional)
├── Cards Grid
│   └── RoasterCard (repeated for each record)
└── Floating Action Button (mobile only)
```

## Data Flow

```typescript
interface RoasterRecord {
  id: number;
  user_id: number;
  date: string;           // YYYY-MM-DD
  start_time: string | null;  // HH:MM
  end_time: string | null;    // HH:MM
  is_leave: boolean;
  is_week_off: boolean;
}

// Transformed to:
interface RoasterData {
  id: number;
  userName: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  isLeave: boolean;
  isWeekOff: boolean;
}
```

## Usage

### Basic Implementation
```tsx
import RoasterDisplay from './pages/RoasterDisplay';

// In your routing
<Route path="/roaster-view" element={<RoasterDisplay />} />
```

### Integration with Existing Layout
```tsx
import Layout from './components/Layout';
import RoasterDisplay from './pages/RoasterDisplay';

<Route path="/" element={<Layout />}>
  <Route path="roaster-view" element={<RoasterDisplay />} />
</Route>
```

## Styling Details

### Color Mapping
| Status | Color | Tailwind Classes |
|--------|-------|------------------|
| Week Off | Slate | `from-slate-100 to-slate-50` |
| Leave | Amber | `from-amber-50 to-orange-50` |
| Scheduled | Emerald | `from-emerald-50 to-teal-50` |
| Total (Stat) | Indigo | `bg-indigo-50` |

### Responsive Padding
- **Mobile**: `p-4`
- **Tablet**: `p-5 sm:p-5`
- **Desktop**: `p-6 md:p-6`

### Gap Spacing
- **Cards Grid**: `gap-4 sm:gap-6`
- **Stats Grid**: `gap-3`
- **Inline Elements**: `gap-2` or `gap-3`

## State Management

### Local States
```typescript
const [selectedDate, setSelectedDate] = useState<string>() // YYYY-MM-DD
const [roasterData, setRoasterData] = useState<RoasterData[]>([])
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)
```

### Computed Values
```typescript
const stats = useMemo(() => ({
  total: roasterData.length,
  scheduled: roasterData.filter(r => !r.isLeave && !r.isWeekOff).length,
  onLeave: roasterData.filter(r => r.isLeave).length,
  weekOff: roasterData.filter(r => r.isWeekOff).length,
}), [roasterData])
```

## API Integration

### Endpoint: GET `/roaster/`
```typescript
const response = await api.get(`/roaster/?date=${selectedDate}`);
// Returns: RoasterRecord[]
```

**Requirements:**
- Authentication token in localStorage
- Admin role required
- Date format: YYYY-MM-DD

## Animations & Transitions

### Framer Motion Effects
1. **Initial Load**: Cards fade in with staggered timing
2. **Date Change**: Layout reflows with smooth transition
3. **FAB (Mobile)**: Scale animation on mount
4. **Hover Effects**: Subtle elevation and color shifts
5. **Error/Empty States**: Fade-in with scale

### CSS Transitions
- **Hover States**: 300ms duration
- **Loading Spinner**: Continuous rotation
- **Skeleton Pulse**: 1.5s animation loop

## Accessibility

### Keyboard Navigation
- Date navigation buttons are keyboard accessible
- Refresh button has clear focus states
- All interactive elements have proper aria labels

### Screen Readers
- Semantic HTML structure (div > proper text hierarchy)
- Clear aria-labels on buttons
- Status badges use descriptive text

### Color Contrast
- All text meets WCAG AA standards
- No information conveyed by color alone
- Status badges have both color and icon/text indicators

## Performance Optimizations

1. **Memoization**: `useMemo` for statistics calculation
2. **Conditional Rendering**: Loading/error states prevent unnecessary renders
3. **Responsive Images**: Gradients instead of image files
4. **CSS Grid**: Efficient layout with `grid` vs flexbox for complex arrangements
5. **Lazy Loading**: Components only render when needed

## Customization Guide

### Change Colors
```tsx
// Modify stat card colors in the stats array
{ label: 'Total', value: stats.total, color: 'indigo', bgColor: 'bg-indigo-50', ... }

// Change status badge colors in RoasterCard
from-indigo-400 to-blue-500  // Change avatar gradient
from-emerald-50 to-teal-50   // Change scheduled badge
```

### Adjust Spacing
```tsx
// Card grid gaps
<div className="gap-4 sm:gap-6">  // Change to gap-3, gap-5, etc.

// Padding
<div className="p-4 sm:p-5 md:p-6">  // Adjust base padding
```

### Modify Typography
```tsx
// Header size
<h1 className="text-2xl sm:text-3xl">  // Change to text-3xl, text-4xl, etc.

// Card names
<h3 className="text-sm sm:text-base">  // Adjust font size
```

## Troubleshooting

### Cards Not Showing
1. Check if token exists in localStorage
2. Verify API endpoint is accessible
3. Check browser console for API errors
4. Ensure date format is YYYY-MM-DD

### Animations Not Working
1. Verify framer-motion is installed: `npm list framer-motion`
2. Check if Tailwind CSS is properly configured
3. Ensure CSS animations are not disabled in browser settings

### Responsive Issues
1. Clear browser cache
2. Use device tools in browser DevTools
3. Check Tailwind breakpoint configuration
4. Verify viewport meta tag exists

## Browser Support

- ✅ Chrome (latest)
- ✅ Firefox (latest)
- ✅ Safari (latest)
- ✅ Edge (latest)
- ⚠️ IE11 (not recommended - no CSS Grid support)

## Dependencies

```json
{
  "react": "^19.2.4",
  "react-router-dom": "^6.22.3",
  "axios": "^1.7.9",
  "framer-motion": "^11.0.3",
  "lucide-react": "^0.363.0"
}
```

## File Structure

```
admin-dashboard/
├── src/
│   ├── pages/
│   │   ├── RoasterDisplay.tsx        (Main component - all-in-one)
│   │   ├── TodayRoaster.tsx          (Management/editing view)
│   │   └── RoasterView.tsx           (Alternative view template)
│   ├── components/
│   │   └── Layout.tsx                (Navigation updated)
│   ├── services/
│   │   └── api.ts                    (API client with interceptors)
│   └── App.tsx                       (Routing configured)
```

## Future Enhancements

1. **Timeline View**: Horizontal timeline for desktop display
2. **Export to PDF**: Download roaster schedule
3. **Bulk Edit**: Select multiple staff for quick updates
4. **Shift Templates**: Pre-configured shift patterns
5. **Notifications**: Real-time updates when roaster changes
6. **Dark Mode**: Toggle between light and dark themes
7. **Mobile App**: React Native version for iOS/Android

## Support & Contribution

For issues or feature requests, please refer to the main project documentation or contact the development team.

---

**Last Updated**: April 1, 2026  
**Component Version**: 1.0.0  
**React Version**: 19.2.4  
**Tailwind CSS**: 3.x
