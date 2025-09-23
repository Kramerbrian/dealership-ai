#!/bin/bash

# DealershipAI System Monitoring Script
# Usage: ./scripts/monitor-system.sh [domain]

DOMAIN=${1:-localhost:3000}
PROTOCOL=${DOMAIN:0:9}

# Determine protocol
if [[ $DOMAIN == localhost:* || $DOMAIN == 127.0.0.1:* ]]; then
    BASE_URL="http://$DOMAIN"
else
    BASE_URL="https://$DOMAIN"
fi

HEALTH_ENDPOINT="$BASE_URL/api/v1/health"
MONITORING_HEALTH_ENDPOINT="$BASE_URL/api/v1/monitoring/health"
METRICS_ENDPOINT="$BASE_URL/api/v1/monitoring/metrics"
ALERTS_ENDPOINT="$BASE_URL/api/v1/monitoring/alerts"
PROBE_STATUS_ENDPOINT="$BASE_URL/api/v1/probe/status"

LOG_FILE="logs/monitoring-$(date +%Y%m%d).log"
ALERT_FILE="logs/alerts-$(date +%Y%m%d).log"

# Create logs directory if it doesn't exist
mkdir -p logs

echo "🔍 DealershipAI System Monitoring"
echo "================================="
echo "Target: $BASE_URL"
echo "Timestamp: $(date)"
echo ""

# Function to log messages
log_message() {
    echo "$(date): $1" | tee -a "$LOG_FILE"
}

# Function to log alerts
log_alert() {
    echo "$(date): ALERT - $1" | tee -a "$ALERT_FILE"
}

# Function to check endpoint with timeout
check_endpoint() {
    local url=$1
    local name=$2
    local timeout=${3:-10}

    local response=$(curl -s -w "%{http_code}:%{time_total}" --max-time $timeout "$url" 2>/dev/null)
    local http_code=$(echo $response | cut -d: -f1 | tail -1)
    local time_total=$(echo $response | cut -d: -f2 | tail -1)

    if [ "$http_code" = "200" ]; then
        echo "✅ $name (${time_total}s)"
        log_message "✅ $name - HTTP $http_code - ${time_total}s"
        return 0
    else
        echo "❌ $name - HTTP $http_code"
        log_message "❌ $name - HTTP $http_code - ${time_total}s"
        log_alert "$name endpoint failed - HTTP $http_code"
        return 1
    fi
}

# Function to check JSON endpoint and extract data
check_json_endpoint() {
    local url=$1
    local name=$2

    local response=$(curl -s --max-time 10 "$url" 2>/dev/null)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null)

    if [ "$http_code" = "200" ]; then
        echo "✅ $name"

        # Parse and display key information
        if command -v jq &> /dev/null; then
            case $name in
                "Health Check")
                    local status=$(echo "$response" | jq -r '.status // "unknown"')
                    local uptime=$(echo "$response" | jq -r '.metrics.uptime // 0')
                    local memory=$(echo "$response" | jq -r '.metrics.memory_usage // 0')
                    echo "   Status: $status, Uptime: ${uptime}s, Memory: ${memory}%"

                    if [ "$status" != "healthy" ]; then
                        log_alert "System health status: $status"
                    fi
                    ;;
                "System Metrics")
                    local heap_usage=$(echo "$response" | jq -r '.system.memory.heap_usage_percent // 0')
                    local uptime=$(echo "$response" | jq -r '.system.uptime // 0')
                    echo "   Heap Usage: ${heap_usage}%, Uptime: ${uptime}s"

                    if [ "$heap_usage" -gt 80 ]; then
                        log_alert "High memory usage: ${heap_usage}%"
                    fi
                    ;;
                "Alerts System")
                    local active_alerts=$(echo "$response" | jq -r '.summary.active // 0')
                    local critical_alerts=$(echo "$response" | jq -r '.summary.critical // 0')
                    echo "   Active Alerts: $active_alerts, Critical: $critical_alerts"

                    if [ "$critical_alerts" -gt 0 ]; then
                        log_alert "$critical_alerts critical alerts active"
                    fi
                    ;;
                "Probe Status")
                    local total_jobs=$(echo "$response" | jq -r '.counts.waiting + .counts.active + .counts.completed // 0')
                    local failed_jobs=$(echo "$response" | jq -r '.counts.failed // 0')
                    echo "   Total Jobs: $total_jobs, Failed: $failed_jobs"

                    if [ "$failed_jobs" -gt 10 ]; then
                        log_alert "High number of failed jobs: $failed_jobs"
                    fi
                    ;;
            esac
        fi

        log_message "✅ $name endpoint responding"
        return 0
    else
        echo "❌ $name - HTTP $http_code"
        log_message "❌ $name - HTTP $http_code"
        log_alert "$name endpoint failed - HTTP $http_code"
        return 1
    fi
}

echo "📊 Endpoint Health Checks"
echo "-------------------------"

# Basic health check
check_endpoint "$HEALTH_ENDPOINT" "Basic Health Check"
health_basic=$?

# Detailed monitoring endpoints
check_json_endpoint "$MONITORING_HEALTH_ENDPOINT" "Health Check"
health_detailed=$?

check_json_endpoint "$METRICS_ENDPOINT" "System Metrics"
metrics=$?

check_json_endpoint "$ALERTS_ENDPOINT" "Alerts System"
alerts=$?

check_json_endpoint "$PROBE_STATUS_ENDPOINT" "Probe Status"
probe=$?

echo ""
echo "🌐 Network & SSL Checks"
echo "-----------------------"

# SSL Certificate check (if HTTPS)
if [[ $BASE_URL == https://* ]]; then
    echo "🔒 SSL Certificate Check"
    ssl_domain=$(echo $BASE_URL | sed 's|https://||' | sed 's|/.*||')

    ssl_info=$(echo | openssl s_client -servername "$ssl_domain" -connect "$ssl_domain:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null)

    if [ $? -eq 0 ]; then
        echo "✅ SSL Certificate Valid"

        # Check expiration
        end_date=$(echo "$ssl_info" | grep notAfter | cut -d= -f2)
        if [ ! -z "$end_date" ]; then
            exp_epoch=$(date -j -f "%b %d %T %Y %Z" "$end_date" "+%s" 2>/dev/null || date -d "$end_date" "+%s" 2>/dev/null)
            current_epoch=$(date "+%s")
            days_left=$(( (exp_epoch - current_epoch) / 86400 ))

            echo "   Expires: $end_date ($days_left days)"

            if [ "$days_left" -lt 30 ]; then
                log_alert "SSL certificate expires in $days_left days"
            fi
        fi
    else
        echo "❌ SSL Certificate Check Failed"
        log_alert "SSL certificate validation failed"
    fi
else
    echo "ℹ️  HTTP endpoint - SSL checks skipped"
fi

echo ""
echo "📈 Performance Tests"
echo "-------------------"

# Page load performance test
echo "🚀 Homepage Performance Test"
homepage_time=$(curl -o /dev/null -s -w '%{time_total}' --max-time 30 "$BASE_URL" 2>/dev/null)

if [ ! -z "$homepage_time" ]; then
    echo "✅ Homepage Load Time: ${homepage_time}s"

    # Alert if load time is too slow
    slow_threshold=3.0
    if (( $(echo "$homepage_time > $slow_threshold" | bc -l) )); then
        log_alert "Slow homepage load time: ${homepage_time}s (threshold: ${slow_threshold}s)"
    fi
else
    echo "❌ Homepage Performance Test Failed"
    log_alert "Homepage performance test failed"
fi

echo ""
echo "📋 Overall System Status"
echo "------------------------"

# Calculate overall health score
total_checks=5
passed_checks=0

[ $health_basic -eq 0 ] && ((passed_checks++))
[ $health_detailed -eq 0 ] && ((passed_checks++))
[ $metrics -eq 0 ] && ((passed_checks++))
[ $alerts -eq 0 ] && ((passed_checks++))
[ $probe -eq 0 ] && ((passed_checks++))

health_percentage=$(( (passed_checks * 100) / total_checks ))

if [ $health_percentage -eq 100 ]; then
    status="🟢 HEALTHY"
    log_message "System status: HEALTHY (${health_percentage}%)"
elif [ $health_percentage -ge 80 ]; then
    status="🟡 DEGRADED"
    log_message "System status: DEGRADED (${health_percentage}%)"
    log_alert "System health degraded: ${health_percentage}% of checks passing"
else
    status="🔴 UNHEALTHY"
    log_message "System status: UNHEALTHY (${health_percentage}%)"
    log_alert "System health critical: ${health_percentage}% of checks passing"
fi

echo "Status: $status"
echo "Health Score: $health_percentage% ($passed_checks/$total_checks checks passing)"
echo ""

# Monitoring recommendations
echo "📝 Monitoring Recommendations"
echo "-----------------------------"
echo "• Run this script every 5-15 minutes via cron"
echo "• Monitor log files: $LOG_FILE and $ALERT_FILE"
echo "• Set up external monitoring service (Uptime Robot, Pingdom, etc.)"
echo "• Configure Slack/email notifications for critical alerts"
echo "• Set up database monitoring if using external DB"
echo ""

# Generate monitoring dashboard URL
echo "🔗 Monitoring URLs"
echo "-----------------"
echo "Health Check:    $MONITORING_HEALTH_ENDPOINT"
echo "System Metrics:  $METRICS_ENDPOINT"
echo "Active Alerts:   $ALERTS_ENDPOINT?status=active"
echo "Probe Status:    $PROBE_STATUS_ENDPOINT"
echo ""

# Exit with appropriate code
if [ $health_percentage -ge 80 ]; then
    exit 0
else
    exit 1
fi