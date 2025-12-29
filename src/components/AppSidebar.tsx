import { NavLink } from 'react-router-dom';
import {
  Home,
  CreditCard,
  Receipt,
  Calendar,
  MessageSquare,
  Settings,
  PhoneCall,
  TrendingUp,
  FileText,
  LogOut,
  Users,
  Shield,
  Navigation,
  FolderOpen,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { useAuth } from '@/components/AuthProvider';
import { Button } from '@/components/ui/button';

const navigationItems = [
  { title: 'Dashboard', url: '/', icon: Home },
  { title: 'Family', url: '/family', icon: Users },
  { title: 'Transactions', url: '/transactions', icon: Receipt },
  { title: 'Budget', url: '/budget', icon: TrendingUp },
  { title: 'Expense Requests', url: '/expenses', icon: FileText },
  { title: 'Virtual Cards', url: '/cards', icon: CreditCard },
  { title: 'Calendar', url: '/calendar', icon: Calendar },
  { title: 'Messages', url: '/messages', icon: MessageSquare },
  { title: 'Emergency Contacts', url: '/contacts', icon: PhoneCall },
  { title: 'Compliance', url: '/compliance', icon: Shield },
  { title: 'Visitation Tracker', url: '/visitation', icon: Navigation },
  { title: 'Documents', url: '/documents', icon: FolderOpen },
  { title: 'Settings', url: '/settings', icon: Settings },
];

export function AppSidebar() {
  const { signOut } = useAuth();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4 bg-gradient-to-br from-primary/5 via-white to-secondary/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-brand ring-2 ring-primary/20">
            <CreditCard className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-sm text-gradient-brand">
              SupportCard
            </span>
            <span className="text-xs text-muted-foreground font-medium">SouthSphere.co</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === '/'}
                      className={({ isActive }) =>
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : ''
                      }
                    >
                      <item.icon className="w-4 h-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        <Button
          variant="ghost"
          className="w-full justify-start"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
