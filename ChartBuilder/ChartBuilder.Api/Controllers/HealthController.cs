using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using ChartBuilder.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace ChartBuilder.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class HealthController : ControllerBase
{
    private readonly AppDbContext _dbContext;

    public HealthController(AppDbContext dbContext)
    {
        _dbContext = dbContext;
    }

    [AllowAnonymous]
    [HttpGet]
    public IActionResult Get()
    {
        return Ok(new
        {
            status = "ok",
            service = "ChartBuilder.Api",
            utc = DateTime.UtcNow
        });
    }

    [AllowAnonymous]
    [HttpGet("db")]
    public async Task<IActionResult> Db(CancellationToken cancellationToken)
    {
        try
        {
            var canConnect = await _dbContext.Database.CanConnectAsync(cancellationToken);
            if (!canConnect)
            {
                return StatusCode(StatusCodes.Status503ServiceUnavailable, new
                {
                    status = "degraded",
                    database = "unreachable",
                    utc = DateTime.UtcNow
                });
            }

            return Ok(new
            {
                status = "ok",
                database = "reachable",
                utc = DateTime.UtcNow
            });
        }
        catch (Exception)
        {
            return StatusCode(StatusCodes.Status503ServiceUnavailable, new
            {
                status = "degraded",
                database = "unreachable",
                utc = DateTime.UtcNow
            });
        }
    }
}
