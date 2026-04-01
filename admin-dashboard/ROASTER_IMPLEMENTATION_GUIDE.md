# Implementation Guide: Beautiful Staff Roaster Component

## Quick Start (5 Minutes)

### 1. Component is Already Integrated! ✨

The component is ready to use. Just navigate to:
- **Development**: http://localhost:5173/roaster-view
- **Production**: https://staff-attendance-admin.vercel.app/roaster-view

### 2. Features at a Glance

#### 📱 Mobile Experience
```
┌─────────────────────┐
│ Staff Roaster       │
│ [↻] Refresh         │
├─────────────────────┤
│ [◀] 3 Apr [Today] [▶]│
├─────────────────────┤
│ Total │Scheduled    │
│  10   │    8        │
│ Leave │Week Off     │
│  1    │    1        │
├─────────────────────┤
│  ┌─────────────────┐ │
│  │ [👤] John Smith │ │
│  │ Scheduled ✓     │ │
│  │ 10:00-18:30 ⚡  │ │
│  │ 3 Apr          │ │
│  └─────────────────┘ │
│  ... more cards ...   │
│              ┌─────┐  │
│              │  ➕  │  │ ← FAB (Floating Action)
│              └─────┘  │
└─────────────────────┘
```

#### 🖥️ Desktop Experience
```
┌────────────────────────────────────────────────────────────┐
│ Staff Roaster                            [↻] Refresh        │
├────────────────────────────────────────────────────────────┤
│ [◀] 3 Apr [Today] [▶]                                      │
├────────────────────────────────────────────────────────────┤
│ Total  │ Scheduled │ On Leave │ Week Off                   │
│  10    │    8      │    1     │    1                       │
├────────────────────────────────────────────────────────────┤
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐         │
│ │ [👤] John   │ │ [👤] Sarah   │ │ [👤] Mike    │         │
│ │ Scheduled ✓ │ │ Scheduled ✓  │ │ On Leave ⚠  │         │
│ │ 10:00-18:30 │ │ 09:00-17:00  │ │ N/A         │         │
│ │ 3 Apr       │ │ 3 Apr        │ │ 3 Apr       │         │
│ └──────────────┘ └──────────────┘ └──────────────┘         │
│        ... more cards in grid ...                           │
└────────────────────────────────────────────────────────────┘
```

### 3. Core Components Breakdown

#### **RoasterDisplay.tsx** (Main)
- Handles all state management
- Fetches data from `/roaster/?date=YYYY-MM-DD`
- Manages date navigation
- Displays statistics

#### **RoasterCard** (Inline)
- Displays individual staff member
- Shows status (Scheduled/Leave/Week Off)
- Responsive card with gradient backgrounds

#### **RoasterSkeleton** (Inline)
- Loading state with pulse animation
- Maintains layout consistency during fetch

## Customization Examples

### 1. Change Status Colors

**File**: `admin-dashboard/src/pages/RoasterDisplay.tsx`

```tsx
// In RoasterCard component, find:
const getStatusBadge = () => {
    if (isWeekOff) {
      return (
        <div className="flex items-center gap-2 px-3 py-1 
          bg-gradient-to-r from-slate-100 to-slate-50
          border border-slate-200 rounded-full">
          // Change these classes ↑ to use different colors
```

**Available Color Options**:
- `from-red-100 to-red-50` (Red theme)
- `from-blue-100 to-blue-50` (Blue theme)
- `from-purple-100 to-purple-50` (Purple theme)
- `from-cyan-100 to-cyan-50` (Cyan theme)

### 2. Adjust Spacing for Tablet

**File**: `admin-dashboard/src/pages/RoasterDisplay.tsx`

```tsx
// Find grid in RoasterDisplay:
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
         //         ↑ Mobile  ↑ Tablet  ↑ Desktop    ↑ Gaps

// Change to:
<div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
// Now: 1 col mobile → 3 cols tablet → 4 cols desktop
```

### 3. Hide Statistics Bar on Mobile

```tsx
// Find stats section, wrap with:
<div className="hidden sm:grid grid-cols-2 sm:grid-cols-4 gap-3">
  {/* stats here */}
</div>
```

### 4. Add Custom Actions (Edit/Delete Buttons)

```tsx
// In RoasterCard component, add before closing div:
<div className="mt-4 flex gap-2">
  <button className="flex-1 px-3 py-2 text-xs font-medium 
    rounded-lg bg-indigo-50 text-indigo-600 
    hover:bg-indigo-100 transition-colors">
    Edit
  </button>
  <button className="flex-1 px-3 py-2 text-xs font-medium 
    rounded-lg bg-red-50 text-red-600 
    hover:bg-red-100 transition-colors">
    Delete
  </button>
</div>
```

## API Integration Details

### Endpoint
```
GET /roaster/?date=YYYY-MM-DD
```

### Required Headers (Auto-added by api.ts)
```typescript
{
  "Authorization": "Bearer <token>",
  "Content-Type": "application/json"
}
```

### Request Example
```bash
curl -H "Authorization: Bearer TOKEN" \
  "https://staff-attendance-api.onrender.com/roaster/?date=2026-04-01"
```

### Response Format
```json
[
  {
    "id": 1,
    "user_id": 101,
    "date": "2026-04-01",
    "start_time": "10:00:00",
    "end_time": "18:30:00",
    "is_leave": false,
    "is_week_off": false,
    "created_at": "2026-04-01T14:30:00"
  },
  {
    "id": 2,
    "user_id": 102,
    "date": "2026-04-01",
    "start_time": null,
    "end_time": null,
    "is_leave": true,
    "is_week_off": false,
    "created_at": "2026-04-01T14:30:00"
  }
]
```

## Testing Checklist

### ✅ Desktop (1920x1080+)
- [ ] 3-column grid displays correctly
- [ ] Hover effects work on cards
- [ ] Date navigation is responsive
- [ ] Statistics show in 4-column layout
- [ ] Create button visible in header
- [ ] No mobile FAB visible

### ✅ Tablet (768x1024)
- [ ] 2-column grid displays
- [ ] Touch targets are adequate (44px minimum)
- [ ] Typography is readable
- [ ] Navigation is accessible
- [ ] FAB visible and functional

### ✅ Mobile (375x667)
- [ ] 1-column card stack
- [ ] FAB floating button in bottom-right
- [ ] Date picker is usable
- [ ] No horizontal scrolling
- [ ] Status badges readable
- [ ] Refresh button accessible

### ✅ Functionality
- [ ] Loading skeleton shows while fetching
- [ ] Cards populate after API response
- [ ] Date navigation changes displayed roaster
- [ ] Today button jumps to current date
- [ ] Error state shows with retry button
- [ ] Empty state shows helpful message
- [ ] Statistics update correctly
- [ ] FAB navigates to create schedule page

## Common Issues & Solutions

### Issue: Cards Don't Load
**Solution**:
```typescript
// Check 1: Token exists
console.log(localStorage.getItem('token'));

// Check 2: API response
// Open DevTools → Network → Look for /roaster/ request
// Check status code and response body

// Check 3: Date format
// Verify selectedDate is in YYYY-MM-DD format
console.log(selectedDate);
```

### Issue: Layout Breaking on Tablet
**Solution**:
```tsx
// Ensure proper responsive classes
className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
//        ↑ Base   ↑ 640px+     ↑ 1024px+

// Test with browser DevTools responsive mode
```

### Issue: Animations Lag
**Solution**:
```jsx
// Disable animations if performance is an issue
// Remove motion components or use simpler CSS

// Before (with Framer Motion):
import { motion } from 'framer-motion'
<motion.div animate={{ opacity: 1 }}>

// After (CSS only):
<div className="animate-fade-in">
```

## Performance Optimization Tips

### 1. Reduce API Calls
```typescript
// Current: Fetches every date change
// Optimized: Cache results for 5 minutes

const [cache, setCache] = useState<Record<string, RoasterData[]>>({});

const fetchRoaster = async (date: string) => {
  if (cache[date]) {
    setRoasterData(cache[date]);
    return;
  }
  // ... fetch from API ...
};
```

### 2. Virtual Scrolling (for 100+ records)
```typescript
// Use react-window for large lists
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={roasterData.length}
  itemSize={200}
>
  {({ index, style }) => (
    <RoasterCard
      style={style}
      {...roasterData[index]}
    />
  )}
</FixedSizeList>
```

### 3. Debounce Date Navigation
```typescript
const handlePreviousDay = debounce(() => {
  const date = new Date(selectedDate);
  date.setDate(date.getDate() - 1);
  setSelectedDate(date.toISOString().split('T')[0]);
}, 300);
```

## Navigation Integration

### Adding to Sidebar
Already added! Check `admin-dashboard/src/components/Layout.tsx`:

```tsx
{ to: '/roaster-view', icon: FileText, label: 'View Roaster' }
```

### Adding to Header Menu
```tsx
// In Layout.tsx header
<button onClick={() => navigate('/roaster-view')}
  className="px-4 py-2 bg-indigo-500 text-white rounded-lg">
  View Schedule
</button>
```

## Deployment Checklist

- [ ] framer-motion installed: `npm list framer-motion`
- [ ] Build succeeds: `npm run build`
- [ ] No TypeScript errors: `npx tsc --noEmit`
- [ ] No linting errors: `npm run lint`
- [ ] Backend `/roaster/` endpoint accessible
- [ ] JWT tokens working properly
- [ ] Images/icons load correctly on production
- [ ] Mobile responsive verified
- [ ] Performance acceptable (<3s load time)

## Next Steps

1. **Customize Colors** to match your brand
2. **Test on Devices** using real mobile devices or device labs
3. **Gather Feedback** from users
4. **Optimize Performance** based on usage patterns
5. **Add Features** like export to PDF, bulk editing, etc.

---

**Need Help?**
- Check `ROASTER_COMPONENT_DOCS.md` for detailed documentation
- Review `src/pages/RoasterDisplay.tsx` for implementation
- Check browser DevTools console for errors
