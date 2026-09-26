// Builds the `next`/`previous` relative-URI pair for the paginated envelope,
// preserving whichever urgency/status filters the caller applied.
function buildPageLinks(string path, string? urgency, string? status, int 'limit, int offset, int count)
        returns [string?, string?] {
    string filterQuery = "";
    if urgency is string {
        filterQuery = filterQuery + "&urgency=" + urgency;
    }
    if status is string {
        filterQuery = filterQuery + "&status=" + status;
    }

    string? next = ();
    if offset + 'limit < count {
        next = string `${path}?limit=${'limit}&offset=${offset + 'limit}${filterQuery}`;
    }

    string? previous = ();
    if offset > 0 {
        int previousOffset = offset - 'limit;
        if previousOffset < 0 {
            previousOffset = 0;
        }
        previous = string `${path}?limit=${'limit}&offset=${previousOffset}${filterQuery}`;
    }

    return [next, previous];
}
