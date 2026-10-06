// Pit Wall server: F1 25 (2026 Season Pack) UDP telemetry → live dashboard over WebSocket.
//
//   dotnet run                          live game telemetry on UDP 20777
//   dotnet run -- --sim                 simulated race, no game needed
//   dotnet run -- --record s.f1rec      also save raw packets for later
//   dotnet run -- --replay s.f1rec      play a recording back (loops)
using PitWall.Server;
using PitWall.Server.Configuration;

var builder = WebApplication.CreateBuilder(CommandLine.Expand(args));
builder.Services.AddPitWall(builder.Configuration);

var app = builder.Build();

app.UseWebSockets(new WebSocketOptions { KeepAliveInterval = TimeSpan.FromSeconds(30) });
app.MapDashboardSocket("/ws");
app.MapHealthChecks("/health");

// The built dashboard (frontend/dist, copied to wwwroot in the container). In
// development the Vite dev server serves it instead and proxies /ws here.
app.UseDefaultFiles();
app.UseStaticFiles();
app.MapFallbackToFile("index.html");

app.Run();
